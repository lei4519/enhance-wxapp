import { Interceptors, AjaxOptions } from '../types';
export declare const interceptors: Interceptors;
export declare function requestMethod<T = any>(options: AjaxOptions): Promise<T>;
