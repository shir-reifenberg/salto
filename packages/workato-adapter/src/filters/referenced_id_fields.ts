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

import { Element } from '@salto-io/adapter-api'
import { references, config as configUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { API_DEFINITIONS_CONFIG } from '../config'

const { addReferencesToInstanceNames } = references

/**
 *  Resolves references in elements name using referenced idFields
 *
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => {
    const transformationDefault = config[API_DEFINITIONS_CONFIG].typeDefaults.transformation
    const configByType = config[API_DEFINITIONS_CONFIG].types
    const transformationByType = configUtils.getTransformationConfigByType(configByType)
    await addReferencesToInstanceNames(elements, transformationByType, transformationDefault)
  },
})

export default filter
