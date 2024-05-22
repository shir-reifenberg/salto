/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { BuiltinTypes, InstanceElement, Values } from '@salto-io/adapter-api'
import { UserConfig, createUserConfigType, mergeWithDefaultConfig } from '../../../src/definitions/user'
import { adapterConfigFromConfig, updateDeprecatedConfig } from '../../../src/definitions/user/user_config'

describe('config_shared', () => {
  describe('createUserConfigType', () => {
    it('should return default type when no custom fields were added', () => {
      const type = createUserConfigType({ adapterName: 'myAdapter' })
      expect(Object.keys(type.fields)).toHaveLength(3)
      expect(type.fields.client).toBeDefined()
      expect(type.fields.fetch).toBeDefined()
      expect(type.fields.deploy).toBeDefined()
    })
    it('should add custom fields', () => {
      const type = createUserConfigType({
        adapterName: 'myAdapter',
        additionalFields: { extra: { refType: BuiltinTypes.BOOLEAN } },
      })
      expect(Object.keys(type.fields)).toHaveLength(4)
      expect(type.fields.client).toBeDefined()
      expect(type.fields.fetch).toBeDefined()
      expect(type.fields.deploy).toBeDefined()
      expect(type.fields.extra).toBeDefined()
    })
  })
  describe('mergeWithDefaultConfig', () => {
    let defaultConfig: Values
    let config: Values
    let mergedConfig: Values
    beforeAll(() => {
      defaultConfig = {
        a: 1,
        b: {
          c: 2,
          d: [3, 4],
          e: '5',
        },
      }
      config = {
        a: 2,
        b: {
          c: 3,
          d: [5],
        },
      }

      mergedConfig = mergeWithDefaultConfig(defaultConfig, config)
    })

    it('should merge config with default config', () => {
      expect(mergedConfig).toEqual({
        a: 2,
        b: {
          c: 3,
          d: [5],
          e: '5',
        },
      })
    })

    it('input should be affected', () => {
      expect(defaultConfig).not.toEqual(mergedConfig)
    })
    it('should handle single config', () => {
      mergedConfig = mergeWithDefaultConfig(defaultConfig)
      expect(mergedConfig).toEqual(defaultConfig)
    })
  })
  describe('adapterConfigFromConfig', () => {
    const customConfig: UserConfig<string> & {
      fetch: UserConfig['fetch'] & { customFlag: boolean }
      topLevelProp: string
    } = {
      client: {
        rateLimit: {
          get: 10,
          deploy: 20,
        },
      },
      fetch: {
        include: [{ type: '.*' }],
        exclude: [],
        customFlag: true,
      },
      deploy: {},
      topLevelProp: 'val',
    }
    const customConfigType = createUserConfigType({
      adapterName: 'myAdapter',
      additionalFields: { topLevelProp: { refType: BuiltinTypes.STRING } },
      additionalFetchFields: { customFlag: { refType: BuiltinTypes.BOOLEAN } },
      defaultConfig: customConfig,
      omitElemID: true,
    })
    it('should return default config when no config provided', () => {
      const userConfig = new InstanceElement('config', customConfigType, {})

      const mergedConfig = adapterConfigFromConfig(userConfig, customConfig)
      expect(mergedConfig).toEqual(customConfig)
    })
    it('should return the merged config', () => {
      const userConfig = new InstanceElement('config', customConfigType, {
        fetch: {
          include: [{ type: '.*' }],
          exclude: [{ type: 'Type' }],
        },
        client: {
          rateLimit: { get: 20 },
        },
      })

      const mergedConfig = adapterConfigFromConfig(userConfig, customConfig)
      expect(mergedConfig).toEqual({
        client: {
          rateLimit: {
            get: 20,
            deploy: 20,
          },
        },
        fetch: {
          include: [{ type: '.*' }],
          exclude: [{ type: 'Type' }],
          customFlag: true,
        },
        deploy: {},
        topLevelProp: 'val',
      })
    })
  })
  describe('updateDeprecatedConfig', () => {
    const defaultConfig = {
      fetch: {
        include: [{ type: '.*' }],
        exclude: [],
        customFlag: true,
      },
    }
    const configType = createUserConfigType({
      adapterName: 'myAdapter',
      additionalFetchFields: { customFlag: { refType: BuiltinTypes.BOOLEAN } },
      defaultConfig,
    })
    describe('with no deprecated apiDefinitions', () => {
      const config = new InstanceElement('config', configType, {
        fetch: {
          include: [{ type: '.*' }],
          exclude: [{ type: 'typeB' }],
          customFlag: false,
        },
      })
      it('should return undefined', () => {
        const res = updateDeprecatedConfig(config)
        expect(res).toBeUndefined()
      })
    })
    describe('with deprecated apiDefinitions', () => {
      it('should convert elemID related transformation to elemID config from the new format', () => {
        const config = new InstanceElement('config', configType, {
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
            customFlag: false,
            apiDefinitions: {
              types: {
                foo: {
                  transformation: { idFields: ['name', 'status'] },
                },
                bar: {
                  transformation: {
                    idFields: ['&id', 'name'],
                    extendsParentId: false,
                  },
                },
                myType: {
                  transformation: {
                    idFields: [],
                    extendsParentId: true,
                  },
                },
              },
            },
          },
        })

        const res = updateDeprecatedConfig(config)
        expect(res?.config?.value).toEqual({
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
            customFlag: false,
            elemID: {
              foo: {
                parts: [{ fieldName: 'name' }, { fieldName: 'status' }],
              },
              bar: {
                parts: [{ fieldName: 'id', isReference: true }, { fieldName: 'name' }],
                extendsParent: false,
              },
              myType: {
                parts: [],
                extendsParent: true,
              },
            },
          },
        })
        expect(res?.message).toEqual(
          'The configuration options "apiDefinitions" is deprecated. The following changes will update the deprecated options to the "fetch" configuration option.',
        )
      })
      it('should remove any empty parts from apiDefinitions', () => {
        const config = new InstanceElement('config', configType, {
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
            apiDefinitions: {
              typeDefaults: {
                transformation: {},
              },
              types: {
                foo: {
                  transformation: { idFields: ['name', 'status'] },
                  request: {},
                },
                bar: {
                  request: { recurseInto: [] } // not sure this case is legit
                }
              },
            },
          },
        })

        const res = updateDeprecatedConfig(config)
        expect(res?.config?.value).toEqual({
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
            elemID: {
              foo: {
                parts: [{ fieldName: 'name' }, { fieldName: 'status' }],
              },
            },
          },
        })
      })
      it('should not remove non empty parts from apiDefinitions that are not elemID related', () => {
        const config = new InstanceElement('config', configType, {
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
            apiDefinitions: {
              typeDefaults: {
                transformation: {},
              },
              types: {
                foo: {
                  transformation: { idFields: ['name', 'status'] },
                },
                bar: {
                  request: { url: '/bars'}
                }
              },
            },
          },
        })

        const res = updateDeprecatedConfig(config)
        expect(res?.config?.value).toEqual({
          fetch: {
            include: [{ type: '.*' }],
            exclude: [{ type: 'typeB' }],
            elemID: {
              foo: {
                parts: [{ fieldName: 'name' }, { fieldName: 'status' }],
              },
            },
            apiDefinitions: {
              types: {
                bar: { request: { url: '/bars' } }
              },
            },
          },
        })
      })
      it('should not return updated config if no elemID related definitions are found', () => {
        const config = new InstanceElement('config', configType, {
          fetch: {
            include: [{ type: '.*' }],
            exclude: [],
            apiDefinitions: {
              typeDefaults: {
                transformation: {},
              },
              types: {
                foo: {
                  request: { url: '/foos'}
                },
              },
            },
          },
        })

        const res = updateDeprecatedConfig(config)
        expect(res).toBeUndefined()
      })
    })
  })
})
