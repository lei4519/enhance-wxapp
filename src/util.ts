export function noop() {}

export function disableEnumerable(obj: any, keys: string[]) {
  keys.forEach((key: string) => {
    Object.defineProperty(obj, key, {
      enumerable: false
    })
  })
}

export const transformOnName = (name: string) =>
  `on${name.replace(/\w/, s => s.toUpperCase())}`

const isType = (type: string) => (val: any) =>
  Object.prototype.toString.call(val) === `[object ${type}]`

export const isArray = isType('Array')

export const isObject = isType('Object')

export const isFunction = isType('Function')

/**
 * @description 返回promise，超时后resolve promise
 * @param resolveData promise.resolve 的数据
 * @param timeout 超时时间
 */
export function setTimeoutResolve(resolveData: any, timeout: number = 0) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(resolveData)
    }, timeout)
  })
}
