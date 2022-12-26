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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { ObjectType, InstanceElement, OAuthMethod } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter, createUrlFromUserInput } from '../src/adapter_creator'
import { oauthAccessTokenCredentialsType, usernamePasswordCredentialsType } from '../src/auth'
import { configType } from '../src/config'
import { ZENDESK } from '../src/constants'
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
      Object.keys(usernamePasswordCredentialsType.fields)
    )
  })
  it('should use accessToken as the OAuth auth method', () => {
    expect(adapter.authenticationMethods.oauth).toBeDefined()
    expect(Object.keys(
      (adapter.authenticationMethods.oauth as OAuthMethod).credentialsType.fields
    )).toEqual(Object.keys(oauthAccessTokenCredentialsType.fields))
  })
  it('should return oauth params - only accessToken and baseUrl', () => {
    expect((adapter.authenticationMethods.oauth as OAuthMethod).createFromOauthResponse(
      {
        clientId: 'client',
        port: 8080,
        baseUrl: 'https://abc.zendesk.com',
      },
      {
        fields: {
          accessToken: 'token',
        },
      }
    )).toEqual({
      baseUrl: 'https://abc.zendesk.com',
      accessToken: 'token',
    })
  })
  it('should return the zendesk adapter', () => {
    // with basic auth method
    expect(adapter.operations({
      credentials: new InstanceElement(ZENDESK,
        adapter.authenticationMethods.basic.credentialsType),
      config: new InstanceElement(
        ZENDESK,
        adapter.configType as ObjectType,
        {
          fetch: {
            include: [{
              type: '.*',
            }],
            exclude: [],
          },
          apiDefinitions: {
            types: {},
          },
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toBeDefined()

    // with OAuth auth method
    expect(adapter.operations({
      credentials: new InstanceElement(
        ZENDESK,
        adapter.authenticationMethods.oauth?.credentialsType as ObjectType,
        {
          authType: 'oauth',
          accessToken: 'token',
          baseUrl: 'https://abc.zendesk.com',
        }
      ),
      config: new InstanceElement(
        ZENDESK,
        adapter.configType as ObjectType,
        {
          fetch: {
            include: [{
              type: '.*',
            }],
            exclude: [],
          },
          apiDefinitions: {
            types: {},
          },
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toBeDefined()
  })

  it('should ignore unexpected configuration values', () => {
    expect(adapter.operations({
      credentials: new InstanceElement(ZENDESK,
        adapter.authenticationMethods.basic.credentialsType),
      config: new InstanceElement(
        ZENDESK,
        adapter.configType as ObjectType,
        {
          fetch: {
            include: [{
              type: '.*',
            }],
            exclude: [],
          },
          apiDefinitions: {
            types: {},
          },
          somethingElse: {},
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toBeDefined()
  })

  it('should throw error on inconsistent configuration between fetch and apiDefinitions', () => {
    expect(() => adapter.operations({
      credentials: new InstanceElement(ZENDESK,
        adapter.authenticationMethods.basic.credentialsType),
      config: new InstanceElement(
        ZENDESK,
        adapter.configType as ObjectType,
        {
          fetch: {
            include: [
              { type: 'a' },
              { type: 'b' },
            ],
            exclude: [],
          },
          apiDefinitions: {
            types: {
              c: {
                request: {
                  url: '/api/v2/c',
                },
              },
            },
            supportedTypes: {
              a: ['a'],
              b: ['b'],
            },
          },
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toThrow(new Error('Invalid type names in fetch: a,b does not match any of the supported types.'))
  })

  it('should return right url for oauth request', () => {
    expect(createUrlFromUserInput({
      subdomain: 'abc',
      port: 8080,
      clientId: 'client',
    })).toEqual('https://abc.zendesk.com/oauth/authorizations/new?response_type=token&redirect_uri=http://localhost:8080&client_id=client&scope=read%20write')

    expect(createUrlFromUserInput({
      baseUrl: 'https://abc.zendesk.com',
      port: 8080,
      clientId: 'client',
    })).toEqual('https://abc.zendesk.com/oauth/authorizations/new?response_type=token&redirect_uri=http://localhost:8080&client_id=client&scope=read%20write')
  })

  it('should validate credentials using createConnection', async () => {
    jest.spyOn(connection, 'createConnection')
    jest.spyOn(connection, 'validateCredentials')
    mockAxiosAdapter.onGet('/api/v2/account/settings').reply(200, {
      settings: {},
    })

    // basic auth method
    expect(await adapter.validateCredentials(new InstanceElement(
      'config',
      usernamePasswordCredentialsType,
      { username: 'user123', password: 'pwd456', baseUrl: 'https://abc.zendesk.com' },
    ))).toEqual('https://abc.zendesk.com')

    // OAuth auth method
    expect(await adapter.validateCredentials(new InstanceElement(
      'config',
      oauthAccessTokenCredentialsType,
      { authType: 'oauth', accessToken: 'token', baseUrl: 'https://abc.zendesk.com' },
    ))).toEqual('https://abc.zendesk.com')

    expect(connection.createConnection).toHaveBeenCalledTimes(2)
    expect(connection.validateCredentials).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        credentials: { username: 'user123', password: 'pwd456', baseUrl: 'https://abc.zendesk.com' },
      })
    )

    expect(connection.validateCredentials).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        credentials: { accessToken: 'token', baseUrl: 'https://abc.zendesk.com' },
      })
    )
  })

  it('should be able get subdomain instead of baseUrl', async () => {
    mockAxiosAdapter.onGet('/api/v2/account/settings').reply(200, {
      settings: {},
    })
    expect(await adapter.validateCredentials(new InstanceElement(
      'config',
      usernamePasswordCredentialsType,
      { username: 'user123', password: 'pwd456', subdomain: 'abc' },
    ))).toEqual('https://abc.zendesk.com')
  })
})
