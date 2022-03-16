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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element,
  isInstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, config as configUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/referenced_id_fields'
import ZendeskClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_ID_FIELDS, FIELDS_TO_HIDE } from '../../src/config'
import { ZENDESK_SUPPORT } from '../../src/constants'

const defaultTypes: Record<string, configUtils.TypeDuckTypeConfig> = {
  // types that should exist in workspace
  // eslint-disable-next-line camelcase
  dynamic_content_item: {
    request: {
      url: '/dynamic_content/items',
    },
    transformation: {
      dataField: '.',
      standaloneFields: [{ fieldName: 'variants' }],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
    deployRequests: {
      add: {
        url: '/dynamic_content/items',
        deployAsField: 'item',
        method: 'post',
      },
      modify: {
        url: '/dynamic_content/items/{dynamicContentItemId}',
        method: 'put',
        deployAsField: 'item',
        urlParamsToFields: {
          dynamicContentItemId: 'id',
        },
      },
      remove: {
        url: '/dynamic_content/items/{dynamicContentItemId}',
        method: 'delete',
        deployAsField: 'item',
        urlParamsToFields: {
          dynamicContentItemId: 'id',
        },
      },
    },
  },
  // eslint-disable-next-line camelcase
  dynamic_content_item__variants: {
    transformation: {
      // Will be changed after SALTO-1687 + SALTO-1688
      idFields: ['content', '&locale_id'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
    deployRequests: {
      add: {
        url: '/dynamic_content/items/{dynamicContentItemId}/variants',
        deployAsField: 'variant',
        method: 'post',
        urlParamsToFields: {
          dynamicContentItemId: '_parent.0.id',
        },
      },
      modify: {
        url: '/dynamic_content/items/{dynamicContentItemId}/variants/{dynammicContentVariantId}',
        deployAsField: 'variant',
        method: 'put',
        urlParamsToFields: {
          dynammicContentVariantId: 'id',
          dynamicContentItemId: '_parent.0.id',
        },
      },
      remove: {
        url: '/dynamic_content/items/{dynamicContentItemId}/variants/{dynammicContentVariantId}',
        method: 'delete',
        urlParamsToFields: {
          dynammicContentVariantId: 'id',
          dynamicContentItemId: '_parent.0.id',
        },
      },
    },
  },
  locales: {
    request: {
      url: '/locales',
    },
    transformation: {
      dataField: 'locales',
    },
  },

}

describe('referenced idFields filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  beforeAll(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'c' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        fetch: {
          includeTypes: ['connection', 'recipe'],
        },
        apiDefinitions: {
          typeDefaults: {
            transformation: {
              idFields: DEFAULT_ID_FIELDS,
            },
          },
          types: defaultTypes,
        },
      },
    }) as FilterType
  })

  const localeObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'locale') })
  const localeInstEnUs = new InstanceElement(
    'English',
    localeObjType,
    {
      id: 1,
      locale: 'en-US',
      name: 'English',
      native_name: 'English (United States)',
      presentation_name: 'English (United States)',
      rtl: false,
      default: true,
    },
  )
  const itemVarType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'dynamic_content_item__variants'),
  })
  const itemVarInstance = new InstanceElement(
    'child1',
    itemVarType,
    {
      id: 22,
      content: 'abc',
      locale_id: new ReferenceExpression(localeInstEnUs.elemID, localeInstEnUs),
      active: true,
      default: true,
    },
    undefined,
  )

  const generateElements = (
  ): Element[] => ([
    localeObjType,
    localeInstEnUs,
    itemVarType,
    itemVarInstance,
  ])

  describe('on fetch', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should resolve instances names when references exists', () => {
      const elems = elements.filter(
        e => isInstanceElement(e) && e.elemID.typeName === 'dynamic_content_item__variants'
      ) as InstanceElement[]
      expect(elems[0].elemID.name).toEqual('abc_English')
    })
  })
})
