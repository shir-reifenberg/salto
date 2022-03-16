/*
*                      Copyright 2022 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import _ from 'lodash'
import { Element, isInstanceElement, isReferenceExpression, InstanceElement, ElemID } from '@salto-io/adapter-api'
import { naclCase, setPath, references, getParents } from '@salto-io/adapter-utils'
import { DAG } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { TransformationConfig, TransformationDefaultConfig, getConfigWithDefault } from '../config'
import { joinInstanceNameParts, getInstanceFilePath } from '../elements/instance_elements'
import { isReferencedIdField, dereferenceFieldName } from './referenced_instace_utils'

const { awu } = collections.asynciterable

const log = logger(module)
const { isDefined } = lowerDashValues
const { updateElementReferences, getReferences, getUpdatedReference } = references

const ID_SEPARATOR = '__'

type InstanceIdFields = {
  instance: InstanceElement
  idFields: string[]
}

/*
 * Utility function that finds instance elements whose id relies on the ids of other instances,
 * and replaces them with updated instances with the correct id and file path.
 */
export const addReferencesToInstanceNames = async (
  elements: Element[],
  transformationConfigByType: Record<string, TransformationConfig>,
  transformationDefaultConfig: TransformationDefaultConfig,
): Promise<Element[]> => {
  const hasReferencedIdFields = (
    idFields: string[],
  ): boolean => idFields.some(field => isReferencedIdField(field))

  const instances = elements.filter(isInstanceElement)
  const instancesToIdFields: InstanceIdFields[] = instances.map(instance => ({
    instance,
    idFields: getConfigWithDefault(
      transformationConfigByType[instance.elemID.typeName],
      transformationDefaultConfig
    ).idFields,
  }))

  const graph = new DAG<InstanceElement>()
  instancesToIdFields.forEach(({ instance, idFields }) => {
    const getReferencedInstances = (): string[] => {
      const referencedInstances = idFields
        .filter(isReferencedIdField)
        .map(fieldName => {
          const fieldValue = _.get(instance.value, dereferenceFieldName(fieldName))
          if (isReferenceExpression(fieldValue) && isInstanceElement(fieldValue.value)) {
            return fieldValue.elemID.getFullName()
          }
          return undefined
        })
        .filter(isDefined)
      return referencedInstances
    }
    graph.addNode(instance.elemID.getFullName(), getReferencedInstances(), instance)
  })

  await awu(graph.evaluationOrder()).forEach(
    async graphNode => {
      const instanceIdFields = instancesToIdFields
        .find(instanceF => instanceF.instance.elemID.getFullName() === graphNode.toString())
      if (instanceIdFields !== undefined) {
        const { instance, idFields } = instanceIdFields
        if (idFields !== undefined && hasReferencedIdFields(idFields)) {
          const originalName = instance.elemID.name
          const originalFullName = instance.elemID.getFullName()
          const newNameParts = idFields.map(
            fieldName => {
              if (isReferencedIdField(fieldName)) {
                const fieldValue = _.get(instance.value, dereferenceFieldName(fieldName))
                if (isReferenceExpression(fieldValue) && isInstanceElement(fieldValue.value)) {
                  return fieldValue.elemID.name
                }
                log.warn(`could not find reference for referenced idField: ${fieldName}, falling back to original value`)
                return fieldValue
              }
              return _.get(instance.value, fieldName)
            }
          )
          const newName = joinInstanceNameParts(newNameParts, originalName)
          const parentIds = getParents(instance)
            .filter(parent => isReferenceExpression(parent) && isInstanceElement(parent.value))
            .map(parent => parent.value.elemID.name)
          const newNaclName = naclCase(
            parentIds.length > 0
              ? `${parentIds.join(ID_SEPARATOR)}${ID_SEPARATOR}${newName}`
              : String(newName)
          )

          const { typeName, adapter } = instance.elemID
          const { fileNameFields } = getConfigWithDefault(
            transformationConfigByType[typeName],
            transformationDefaultConfig,
          )
          const filePath = transformationConfigByType[typeName].isSingleton
            ? instance.path
            : getInstanceFilePath({
              fileNameFields,
              entry: instance.value,
              naclName: newNaclName,
              typeName,
              isSettingType: false,
              adapterName: adapter,
            })

          const newElemId = new ElemID(adapter, typeName, 'instance', newNaclName)
          const updatedInstance = await updateElementReferences(
            instance,
            instance.elemID,
            newElemId,
          )

          const newInstance = new InstanceElement(
            newElemId.name,
            updatedInstance.refType,
            updatedInstance.value,
            filePath,
            updatedInstance.annotations,
          )

          elements
            .filter(isInstanceElement)
          // filtering out the renamed element,
          // its references are taken care of in getRenameElementChanges
            .filter(element => originalFullName !== element.elemID.getFullName())
            .forEach(element => {
              const refs = getReferences(element, instance.elemID)
              if (refs.length > 0) {
                refs.forEach(ref => {
                  const updatedReference = getUpdatedReference(ref.value, newElemId)
                  setPath(element, ref.path, updatedReference)
                })
              }
            })

          const instanceIdx = elements.findIndex(e => (e.elemID.getFullName()) === originalFullName)
          elements.splice(instanceIdx, 1, newInstance)
        }
      }
    }
  )
  return elements
}
