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
import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { statusValidator } from '../../src/change_validators/status'
import { JIRA, STATUS_TYPE_NAME } from '../../src/constants'

describe('statusValidator', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) })
    instance = new InstanceElement('instance', type)
  })
  it('should return if status category is No_Category', async () => {
    instance.value.statusCategory = new ReferenceExpression(
      new ElemID(JIRA, 'StatusCategory', 'instance', 'No_Category@s')
    )
    expect(await statusValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'statusCategory can not have No_Category value',
        detailedMessage: 'The status jira.Status.instance.instance have an invalid statusCategory, statusCategory should be one of the following: [ Done, In_Progress, To_Do ]',
      },
    ])
  })

  it('should not return an error if status category is not No_Category', async () => {
    instance.value.statusCategory = new ReferenceExpression(
      new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'Done')
    )

    expect(await statusValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })
})
