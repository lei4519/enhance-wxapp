import {
  cloneDeep,
  disabledEnumerable,
  isFunction,
  isObject,
  isPrimitive,
  resolvePromise
} from './util'
import {
  isReactive,
  isRef,
  reactive,
  toRaw,
  toRef,
  unref
} from '@vue/reactivity'
import { updateData } from './setDataEffect'
import { watch } from '@vue/runtime-core'
import { EnhanceRuntime, LooseObject, DecoratorType } from '../types'

export function handlerSetup(
  ctx: EnhanceRuntime,
  options: LooseObject,
  type: DecoratorType
) {
  // 解除与ctx.data的引用关系，创建响应式data$
  !ctx.data && (ctx.data = {})
  ctx.data$ = reactive(cloneDeep(ctx.data))
  // 初始化属性，判断数据是否正在被watch
  disabledEnumerable(ctx, '__watching__', false)
  disabledEnumerable(ctx, '__stopWatchFn__', null)
  disabledEnumerable(ctx, '__oldData__', null)
  // 执行setup
  const setupData = ctx.setup.call(ctx, options)
  if (isObject(setupData)) {
    Object.keys(setupData).forEach(key => {
      const val = setupData[key]
      if (isFunction(setupData[key])) {
        ctx[key] = val
      } else {
        // 直接返回reactive值，需要将里面的属性继续ref化
        ctx.data$[key] =
          isReactive(setupData) && isPrimitive(val)
            ? toRef(setupData, key)
            : val
        ctx.data[key] = isRef(val) ? unref(val) : toRaw(val)
      }
    })
    ctx.__oldData__ = cloneDeep(ctx.data)
    // 同步合并后的值到渲染层
    if (type === 'page') {
      ctx.setData(ctx.data)
    } else {
      // 组件的setData在attached时才可以用
      // 保证于其他钩子执行前执行
      ctx.__hooks__.attached.unshift(function initComponentSetData() {
        ctx.setData(ctx.data)
      })
      // 推出setData，只执行一次
      ctx.$once('attached:finally', () => {
        const delIdx = ctx.__hooks__.attached.findIndex(
          fn => fn.name === 'initComponentSetData'
        )
        ctx.__hooks__.attached.splice(delIdx, 1)
      })
    }
  }
  const watching = createWatching(ctx)
  const stopWatching = createStopWatching(ctx)
  if (type === 'page') {
    // 页面在onLoad/onShow中watch
    // 响应式监听要先于其他函数前执行
    ctx.__hooks__.onLoad.unshift(watching)
    ctx.__hooks__.onShow.unshift(() => {
      if (ctx['__onHide:resolve__'] && !ctx.__watching__) {
        resolvePromise.then(() => updateData(ctx))
      }
      watching()
    })
    // onHide/unLoad结束，取消监听
    ctx.$on('onHide:finally', stopWatching)
    ctx.$on('onUnLoad:finally', stopWatching)
  } else {
    // 组件在attached/onShow中watch
    // 响应式监听要先于其他函数前执行
    ctx.__hooks__.attached.unshift(() => {
      if (ctx['__detached:resolve__'] && !ctx.__watching__) {
        resolvePromise.then(() => updateData(ctx))
      }
      watching()
    })
    ctx.__hooks__.show.unshift(() => {
      if (ctx['__hide:resolve__'] && !ctx.__watching__) {
        resolvePromise.then(() => updateData(ctx))
      }
      watching()
    })
    // detached/onHide 中移除watch
    ctx.$on('hide:finally', stopWatching)
    ctx.$on('detached:finally', stopWatching)
  }
  return setupData
}

export function watching(this: EnhanceRuntime) {
  // 如果已经被监控了，就直接退出
  if (this.__watching__) return
  this.__watching__ = true
  // 保留取消监听的函数
  this.__stopWatchFn__ = watch(this.data$, () => {
    updateData(this)
  })
}

function createWatching(ctx: EnhanceRuntime) {
  return watching.bind(ctx)
}

export function stopWatching(this: EnhanceRuntime) {
  // 如果已经取消监听了，就直接退出
  if (!this.__watching__) return
  this.__watching__ = false
  // 执行取消监听
  this.__stopWatchFn__()
}

function createStopWatching(ctx: EnhanceRuntime) {
  return stopWatching.bind(ctx)
}
