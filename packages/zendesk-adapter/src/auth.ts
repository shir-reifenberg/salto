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
import { ElemID, BuiltinTypes } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import * as constants from './constants'

export type UsernamePasswordCredentials = {
  username: string
  password: string
  baseUrl: string
}

export type OauthAccessTokenCredentials = {
  accessToken: string
  baseUrl: string
}

export type OauthRequestParameters = {
  clientId: string
  port: number
  baseUrl: string
}

export const usernamePasswordCredentialsType = createMatchingObjectType<
  UsernamePasswordCredentials
>({
  elemID: new ElemID(constants.ZENDESK),
  fields: {
    username: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    password: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    baseUrl: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
        message: 'Base URL (https://<your-subdomain>.zendesk.com/)',
      },
    },
  },
})

export const oauthAccessTokenCredentialsType = createMatchingObjectType<
  OauthAccessTokenCredentials
>({
  elemID: new ElemID(constants.ZENDESK),
  fields: {
    accessToken: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    baseUrl: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
        message: 'Base URL (https://<your-subdomain>.zendesk.com/)',
      },
    },
  },
})

export const oauthRequestParametersType = createMatchingObjectType<
  OauthRequestParameters
>({
  elemID: new ElemID(constants.ZENDESK),
  fields: {
    clientId: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Client ID',
        _required: true,
      },
    },
    port: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        message: 'Port',
        _required: true,
      },
    },
    baseUrl: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
        message: 'Base URL (https://<your-subdomain>.zendesk.com/)',
      },
    },
  },
})

export type Credentials = UsernamePasswordCredentials | OauthAccessTokenCredentials

export const isOauthAccessTokenCredentials = (
  creds: Credentials
): creds is OauthAccessTokenCredentials =>
  (creds as OauthAccessTokenCredentials).accessToken !== undefined
