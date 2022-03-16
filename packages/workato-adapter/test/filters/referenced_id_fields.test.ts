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

import { ElemID, InstanceElement, ObjectType, Element, BuiltinTypes, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, config as configUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/referenced_id_fields'
import WorkatoClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { WORKATO } from '../../src/constants'

const FIELDS_TO_HIDE: configUtils.FieldToHideType[] = []
const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'created_at', fieldType: 'string' },
  { fieldName: 'updated_at', fieldType: 'string' },
  { fieldName: 'extended_input_schema' },
  { fieldName: 'extended_output_schema' },
]

const defaultTypes: Record<string, configUtils.TypeDuckTypeConfig> = {
  recipe: {
    request: {
      url: '/recipes',
      paginationField: 'since_id',
    },
    transformation: {
      idFields: ['name', '&folder_id'],
      fieldsToHide: [
        ...FIELDS_TO_HIDE,
        { fieldName: 'id' },
        { fieldName: 'user_id' },
      ],
      fieldsToOmit: [
        ...FIELDS_TO_OMIT,
        { fieldName: 'last_run_at' },
        { fieldName: 'job_succeeded_count' },
        { fieldName: 'job_failed_count' },
        { fieldName: 'copy_count' },
        { fieldName: 'lifetime_task_count' },
      ],
      standaloneFields: [
        { fieldName: 'code', parseJSON: true },
      ],
    },
  },
  recipe__code: {
    transformation: {
      idFields: [], // there is one code per recipe, so no need for additional details
    },
  },
  folder: {
    request: {
      url: '/folders',
      recursiveQueryByResponseField: {
        // eslint-disable-next-line camelcase
        parent_id: 'id',
      },
      paginationField: 'page',
    },
    transformation: {
      idFields: ['id', '&parent_id'],
      fieldsToHide: [
        ...FIELDS_TO_HIDE,
        { fieldName: 'id' },
      ],
    },
  },
}

describe('referenced idFields filter', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  beforeAll(() => {
    client = new WorkatoClient({
      credentials: { username: 'a', token: 'b' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        fetch: {
          includeTypes: ['connection', 'folder'],
        },
        apiDefinitions: {
          typeDefaults: {
            transformation: {
              idFields: ['id'],
            },
          },
          types: defaultTypes,
        },
      },
    }) as FilterType
  })

  const folderType = new ObjectType({
    elemID: new ElemID(WORKATO, 'folder'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      // eslint-disable-next-line camelcase
      parent_id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const rootFolder = new InstanceElement(
    'folder11',
    folderType,
    { id: 11, parent_id: 'ROOT' },
  )
  const recipeType = new ObjectType({
    elemID: new ElemID(WORKATO, 'recipe'),
    fields: {
      name: { refType: BuiltinTypes.STRING },
      // eslint-disable-next-line camelcase
      folder_id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const goodFolder = new InstanceElement(
    'folder222',
    folderType,
    { id: 222, parent_id: new ReferenceExpression(rootFolder.elemID, rootFolder) }
  )
  const goodRecipe = new InstanceElement(
    'rec',
    recipeType,
    { name: 'good_recipe', folder_id: new ReferenceExpression(goodFolder.elemID, goodFolder) }
  )

  const generateElements = (
  ): Element[] => ([
    folderType,
    rootFolder,
    goodRecipe,
    goodFolder,
  ])

  describe('on fetch', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should resolve instances names when references exists', () => {
      const folders = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'folder'
      ) as InstanceElement[]
      expect(folders).toHaveLength(2)
      expect(folders[0].elemID.name).toEqual('11_ROOT')
      expect(folders[1].elemID.name).toEqual('222_11_ROOT')

      const theRecipe = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'recipe'
      ) as InstanceElement[]
      expect(theRecipe[0].elemID.name).toEqual('good_recipe_222_11_ROOT')
    })
  })
})
