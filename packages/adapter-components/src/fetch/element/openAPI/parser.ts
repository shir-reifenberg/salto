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
import { loadSwagger } from '../../../elements/swagger'
import { SchemasAndRefs, isV3 } from '../../../elements/swagger/type_elements/swagger_parser'

export const getParsedSchemas = async ({ swaggerPath }: { swaggerPath: string }): Promise<SchemasAndRefs> => {
  const swagger = await loadSwagger(swaggerPath)

  const schemas = isV3(swagger.document) ? swagger.document.components?.schemas : swagger.document.definitions
  return {
    // TODO SALTO-5649 return schemas reachable from endpoints as well
    schemas: schemas ?? {},
    refs: swagger.parser.$refs,
  }
}
