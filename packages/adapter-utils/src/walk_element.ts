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
import _ from 'lodash'
import {
  ElemID, Values, Value, isInstanceElement, isType, isObjectType, isElement,
} from '@salto-io/adapter-api'

export enum WALK_NEXT_STEP {
  RECURSE, // Continue with the recursion
  SKIP, // Don't go deeper in the recursion (on that branch)
  EXIT, // Stop the entire walk, no matter where you are
}
type WalkOnFuncArgs = {
  value: Value
  path: ElemID
}
export type WalkOnFunc = (args: WalkOnFuncArgs) => WALK_NEXT_STEP
class ExitWalk extends Error {}

export const walkOnElement = (
  {
    element,
    func,
  }: {
    element: Value
    func: WalkOnFunc
  }
): void => {
  const run = (value: Value, keyPathID: ElemID): void => {
    const runOnValues = (values: Values): void => {
      _.mapValues(values, (val, key) => run(val, keyPathID?.createNestedID(key)))
    }
    const res = func({ value, path: keyPathID })
    if (res === WALK_NEXT_STEP.EXIT) {
      throw new ExitWalk()
    }
    if (res === WALK_NEXT_STEP.SKIP) {
      return
    }
    if (isElement(value)) {
      if (isType(value)) {
        run(value.annotations, value.elemID.createNestedID('attr'))
      } else {
        runOnValues(value.annotations)
      }
      if (isObjectType(value)) {
        run(value.fields, value.elemID.createNestedID('field'))
      } else if (isInstanceElement(value)) {
        runOnValues(value.value)
      }
    } else if (_.isArray(value)) {
      value.forEach((item, index) => run(item, keyPathID?.createNestedID(String(index))))
    } else if (_.isPlainObject(value)) {
      runOnValues(value)
    }
  }
  try {
    run(element, element.elemID)
  } catch (e) {
    if (e instanceof ExitWalk) {
      return
    }
    throw e
  }
}
