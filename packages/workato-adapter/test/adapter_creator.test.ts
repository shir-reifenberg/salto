/*
*                      Copyright 2021 Salto Labs Ltd.
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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { ObjectType, InstanceElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import WorkatoAdapter from '../src/adapter'
import { adapter } from '../src/adapter_creator'
import { usernameTokenCredentialsType } from '../src/auth'
import { configType } from '../src/config'
import { WORKATO } from '../src/constants'
import * as connection from '../src/client/connection'

describe('adapter creator', () => {
  let mockAxiosAdapter: MockAdapter
  beforeEach(() => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  it('should return a config containing the right parameters', () => {
    const config = adapter.configType as ObjectType
    expect(Object.keys(config?.fields)).toEqual(Object.keys(configType.fields))
  })
  it('should use username+token as the basic auth method', () => {
    expect(Object.keys(adapter.authenticationMethods.basic.credentialsType.fields)).toEqual(
      Object.keys(usernameTokenCredentialsType.fields)
    )
  })
  it('should return the workato adapter', () => {
    expect(adapter.operations({
      credentials: new InstanceElement(WORKATO,
        adapter.authenticationMethods.basic.credentialsType),
      config: new InstanceElement(
        WORKATO,
        adapter.configType as ObjectType,
        {
          fetch: {
            includeTypes: [],
          },
          apiDefinitions: {
            types: {},
          },
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toBeInstanceOf(WorkatoAdapter)
  })

  it('should ignore unexpected configuration values', () => {
    expect(adapter.operations({
      credentials: new InstanceElement(WORKATO,
        adapter.authenticationMethods.basic.credentialsType),
      config: new InstanceElement(
        WORKATO,
        adapter.configType as ObjectType,
        {
          fetch: {
            includeTypes: [],
          },
          apiDefinitions: {
            types: {},
          },
          somethingElse: {},
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toBeInstanceOf(WorkatoAdapter)
  })

  it('should throw error on inconsistent configuration between fetch and apiDefinitions', () => {
    expect(() => adapter.operations({
      credentials: new InstanceElement(WORKATO,
        adapter.authenticationMethods.basic.credentialsType),
      config: new InstanceElement(
        WORKATO,
        adapter.configType as ObjectType,
        {
          fetch: {
            includeTypes: [
              'a',
              'b',
            ],
          },
          apiDefinitions: {
            types: {
              c: {
                request: {
                  url: '/c',
                },
              },
            },
          },
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toThrow(new Error('Invalid type names in fetch: a,b'))
  })

  it('should throw error on invalid serviceConnectionNames configuration', () => {
    expect(() => adapter.operations({
      credentials: new InstanceElement(WORKATO,
        adapter.authenticationMethods.basic.credentialsType),
      config: new InstanceElement(
        WORKATO,
        adapter.configType as ObjectType,
        {
          fetch: {
            includeTypes: [],
            serviceConnectionNames: {
              salesforce: ['abc'],
              unsupportedName: ['def'],
            },
          },
          apiDefinitions: {
            types: {
              c: {
                request: {
                  url: '/c',
                },
              },
            },
          },
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toThrow(new Error('Unsupported service names in fetch.serviceConnectionNames: unsupportedName. The supported services are: salesforce,netsuite,zuora_billing'))
  })

  it('should validate credentials using createConnection', async () => {
    jest.spyOn(connection, 'createConnection')
    mockAxiosAdapter.onGet('/users/me').reply(200, {
      id: 'user123',
    })
    expect(await adapter.validateCredentials(new InstanceElement(
      'config',
      usernameTokenCredentialsType,
      { username: 'user123', token: 'token456' },
    ))).toEqual('')
    expect(connection.createConnection).toHaveBeenCalledTimes(1)
  })
})
