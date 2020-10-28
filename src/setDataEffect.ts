import { cloneDeep, cloneDeepRawData, isFunction } from './util'
import { diffData } from '@/diffData'
import { EnhanceRuntime, LooseFunction, LooseObject } from '../types'
// 需要更新的异步队列
const setDataCtxQueue: Set<EnhanceRuntime> = new Set()
// 是否注册了异步任务
let isFlushing = false

export function setDataQueueJob(ctx: EnhanceRuntime) {
  if (!setDataCtxQueue.has(ctx)) {
    setDataCtxQueue.add(ctx)
    setDataQueueFlush()
  }
}

function setDataQueueFlush() {
  if (!isFlushing) {
    isFlushing = true
    Promise.resolve().then(flushSetDataJobs)
  }
}

function flushSetDataJobs() {
  setDataCtxQueue.forEach(ctx => {
    const res = diffData(ctx.__oldData__, ctx.data$)
    if (!res) return ctx.$emit('setDataRender:resolve')
    // console.log('响应式触发this.setData，参数: ', res)
    ctx.setData(
      res,
      () => {
        ctx.$emit('setDataRender:resolve')
      },
      false
    )
    ctx.__oldData__ = cloneDeep(ctx.data)
  })
  setDataCtxQueue.clear()
  isFlushing = false
}
export let userSetDataFlag = false
export function setData(
  this: EnhanceRuntime,
  rawSetData: LooseFunction,
  data: LooseObject,
  cb: LooseFunction,
  isUserInvoke = true
) {
  if (isUserInvoke) {
    userSetDataFlag = true
    // 同步 data$ 值
    try {
      Object.entries(data).forEach(([paths, value]) => {
        const pathsArr = paths.replace(/(\[(\d+)\])/g, '.$2').split('.')
        const key = pathsArr.pop()!
        let obj = this.data$
        while (pathsArr.length) {
          /* istanbul ignore next */
          obj = obj[pathsArr.shift()!]
        }
        obj[key] = value
      })
    } catch (err) {
      console.error('同步this.data$失败：', err)
    }
  }
  rawSetData.call(this, data, cb)
  this.__oldData__ = cloneDeep(this.data)
  if (isUserInvoke) {
    userSetDataFlag = false
  }
}

export function setDataNextTick(this: EnhanceRuntime, cb?: LooseFunction) {
  let resolve: any
  let promise = new Promise(r => (resolve = r))
  this.$once('setDataRender:resolve', resolve!)
  if (isFunction(cb)) {
    promise = promise.then(cb)
  }
  return promise!
}
