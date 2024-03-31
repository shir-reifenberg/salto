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
import { InstanceElement, Adapter, Values } from '@salto-io/adapter-api'
import { client as clientUtils, definitions as definitionsUtils } from '@salto-io/adapter-components'
import OktaClient from './client/client'
import OktaAdapter from './adapter'
import {
  Credentials,
  accessTokenCredentialsType,
  OAuthAccessTokenCredentials,
  isOAuthAccessTokenCredentials,
} from './auth'
import { CLIENT_CONFIG } from './config'
import { createConnection } from './client/connection'
import { validateOktaBaseUrl } from './utils'
import { getAdminUrl } from './client/admin'
import { DEFAULT_CONFIG, OktaUserConfig, configType } from './user_config'

const { validateCredentials } = clientUtils
const { adapterConfigFromConfig } = definitionsUtils

const isOAuthConfigCredentials = (configValue: Readonly<Values>): configValue is OAuthAccessTokenCredentials =>
  configValue.authType === 'oauth' &&
  'refreshToken' in configValue &&
  'clientId' in configValue &&
  'clientSecret' in configValue

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => {
  const { value } = config
  const { baseUrl } = value
  validateOktaBaseUrl(baseUrl)
  return isOAuthConfigCredentials(value)
    ? {
        baseUrl,
        clientId: value.clientId,
        clientSecret: value.clientSecret,
        refreshToken: value.refreshToken,
      }
    : { baseUrl, token: config.value.token }
}

const createAdminClient = (credentials: Credentials, config: OktaUserConfig): OktaClient | undefined => {
  const clientConfig = config[CLIENT_CONFIG]
  if (clientConfig?.usePrivateAPI !== true) {
    // we use admin client for private api calls only
    return undefined
  }
  const adminUrl = getAdminUrl(credentials.baseUrl)
  return adminUrl !== undefined
    ? new OktaClient({
        credentials: { ...credentials, baseUrl: adminUrl },
        config: clientConfig,
      })
    : undefined
}

export const adapter: Adapter = {
  operations: context => {
    const config = adapterConfigFromConfig<never, OktaUserConfig>(context.config, DEFAULT_CONFIG)
    const credentials = credentialsFromConfig(context.credentials)
    const isOAuthLogin = isOAuthAccessTokenCredentials(credentials)
    const adapterOperations = new OktaAdapter({
      client: new OktaClient({
        credentials,
        config: config.client,
      }),
      userConfig: config,
      configInstance: context.config,
      getElemIdFunc: context.getElemIdFunc,
      elementsSource: context.elementsSource,
      isOAuthLogin,
      adminClient: !isOAuthLogin ? createAdminClient(credentials, config) : undefined,
    })

    return {
      deploy: adapterOperations.deploy.bind(adapterOperations),
      fetch: async args => adapterOperations.fetch(args),
      deployModifiers: adapterOperations.deployModifiers,
      fixElements: adapterOperations.fixElements.bind(adapterOperations),
    }
  },
  validateCredentials: async config =>
    validateCredentials(credentialsFromConfig(config), {
      createConnection,
    }),
  authenticationMethods: {
    basic: {
      credentialsType: accessTokenCredentialsType,
    },
  },
  configType,
}
