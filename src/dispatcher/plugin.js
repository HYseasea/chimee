// @flow
import {isError, isString, isFunction, isEmpty, isObject, isBoolean, isInteger, isPromise, deepAssign, bind, isArray, Log} from 'chimee-helper';
import {before, accessor, applyDecorators, frozen, autobindClass, nonenumerable, nonextendable} from 'toxic-decorators';
import {eventBinderCheck, attrAndStyleCheck} from 'helper/checker';
import {domEvents} from 'helper/const';
import VideoWrapper from 'dispatcher/video-wrapper';

/**
 * <pre>
 * Plugin is the class for plugin developer.
 * When we use a plugin, we will generate an instance of plugin.
 * Developer can do most of things base on this plugin
 * </pre>
 */
export default @autobindClass() class Plugin extends VideoWrapper {
  __dispatcher: Dispatcher;
  __id: string;
  beforeCreate: Function;
  create: Function;
  destroy: Function;
  init: Function;
  inited: Function;
  ready: Promise<*>;
  readySync: boolean;
  destroyed: boolean;
  $dom: HTMLElement;
  __events: PluginEvents;
  $level: number;
  __level: number;
  $operable: boolean;
  __operable: boolean;
  $config: PluginOption;
  $videoConfig: VideoConfig;
  $inner: boolean;
  $operable: boolean;
  $autoFocus: boolean;
  $penetrate: boolean;
  VERSION: string;
  destroyed = false;
  VERSION = process.env.PLAYER_VERSION;
  __operable = true;
  __events = {};
  __level = 0;
  /**
   * <pre>
   * to create a plugin, we need three parameter
   * 1. the config of a plugin
   * 2. the dispatcher
   * 3. this option for plugin to read
   * this is the plugin base class, which you can get on Chimee
   * You can just extends it and then install
   * But in that way you must remember to pass the arguments to super()
   * </pre>
   * @param  {string}  PluginConfig.id        camelize from plugin's name or class name.
   * @param  {string}  PluginConfig.name      plugin's name or class name
   * @param  {Number}  PluginConfig.level     the level of z-index
   * @param  {Boolean} PluginConfig.operable  to tell if the plugin can be operable, if not, we will add pointer-events: none on it.
   * @param  {Function}  PluginConfig.create  the create function which we will called when plugin is used. sth like constructor in object style.
   * @param  {Function}  PluginConfig.destroy   function to be called when we destroy a plugin
   * @param  {Object}  PluginConfig.events    You can set some events handler in this object, we will bind it once you use the plugin.
   * @param  {Object}  PluginConfig.data      dataset we will bind on data in object style
   * @param  {Object<{get: Function, set: Function}}  PluginConfig.computed  dataset we will handle by getter and setter
   * @param  {Object<Function>}  PluginConfig.methods   some function we will bind on plugin
   * @param  {string|HTMLElment}  PluginConfig.el  can be string or HTMLElement, we will use this to create the dom for plugin
   * @param  {boolean} PluginConfig.penetrate boolean to let us do we need to forward the dom events for this plugin.
   * @param  {Dispatcher}  dispatcher referrence of dispatcher
   * @param  {Object}  option  PluginOption that will pass to the plugin
   * @return {Plugin}  plugin instance
   */
  constructor ({
    id,
    name,
    level = 0,
    operable = true,
    beforeCreate,
    create,
    init,
    inited,
    destroy,
    events = {},
    data = {},
    computed = {},
    methods = {},
    el,
    penetrate = false,
    inner = true,
    autoFocus,
    className
  }: PluginConfig = {}, dispatcher: Dispatcher, option: PluginOption = {name}) {
    super();
    if(isEmpty(dispatcher)) {
      Log.error('Dispatcher.plugin', 'lack of dispatcher. Do you forget to pass arguments to super in plugin?');
      throw new TypeError('lack of dispatcher');
    }
    if(!isString(id)) {
      throw new TypeError('id of PluginConfig must be string');
    }
    this.__id = id;
    this.__dispatcher = dispatcher;
    this.$videoConfig = this.__dispatcher.videoConfig;
    this.__wrapAsVideo(this.$videoConfig);
    this.beforeCreate = this.beforeCreate || beforeCreate;
    try {
      isFunction(this.beforeCreate) && this.beforeCreate({
        events,
        data,
        computed,
        methods,
      }, option);
    } catch (error) {
      this.$throwError(error);
    }
    // bind plugin methods into instance
    if(!isEmpty(methods) && isObject(methods)) {
      Object.keys(methods).forEach(key => {
        const fn = methods[key];
        if(!isFunction(fn)) throw new TypeError('plugins methods must be Function');
        Object.defineProperty(this, key, {
          value: bind(fn, this),
          writable: true,
          enumerable: false,
          configurable: true
        });
      });
    }
    // hook plugin events on bus
    if(!isEmpty(events) && isObject(events)) {
      Object.keys(events)
      .forEach(key => {
        if(!isFunction(events[key])) throw new TypeError('plugins events hook must bind with Function');
        this.$on(key, events[key]);
      });
    }
    // bind data into plugin instance
    if(!isEmpty(data) && isObject(data)) {
      deepAssign(this, data);
    }
    // set the computed member by getter and setter
    if(!isEmpty(computed) && isObject(computed)) {
      const props = Object.keys(computed)
      .reduce((props, key) => {
        const val = computed[key];
        if(isFunction(val)) {
          props[key] = accessor({get: val});
          return props;
        }
        if(isObject(val) && (isFunction(val.get) || isFunction(val.set))) {
          props[key] = accessor(val);
          return props;
        }
        Log.warn('Dispatcher.plugin', `Wrong computed member '${key}' defination in Plugin ${name}`);
        return props;
      }, {});
      applyDecorators(this, props, {self: true});
    }
    /**
     * the create Function of plugin
     * @type {Function}
     */
    this.create = this.create || create;
    /**
     * this init Function of plugin
     * which will be called when we start to create the video player
     * the plugin can handle some config here
     * @type {Function}
     */
    this.init = this.init || init;
    /**
     * this inited Function of plugin
     * which will be called when we have created the video player
     * @type {Function}
     */
    this.inited = this.inited || inited;
    /**
     * the destroy Function of plugin
     * @type {Function}
     */
    this.destroy = this.destroy || destroy;
    /**
     * the dom node of whole plugin
     * @type {HTMLElement}
     */
    this.$dom = this.__dispatcher.dom.insertPlugin(this.__id, el, {penetrate, inner, autoFocus, className});
    // now we can frozen inner, autoFocus and penetrate
    this.$inner = inner;
    this.$autoFocus = autoFocus;
    this.$penetrate = penetrate;
    applyDecorators(this, {
      $inner: frozen,
      $autoFocus: frozen,
      $penetrate: frozen
    }, {self: true});
    /**
     * to tell us if the plugin can be operable, can be dynamic change
     * @type {boolean}
     */
    this.$operable = isBoolean(option.operable)
      ? option.operable
      : operable;
    this.__level = isInteger(option.level)
      ? option.level
      : level;
    /**
     * pluginOption, so it's easy for plugin developer to check the config
     * @type {Object}
     */
    this.$config = option;
    try {
      isFunction(this.create) && this.create();
    } catch (error) {
      this.$throwError(error);
    }
  }
  /**
   * call for init lifecycle hook, which mainly handle the original config of video and kernel.
   * @param {VideoConfig} videoConfig the original config of the videoElement or Kernel
   */
  __init (videoConfig: VideoConfig) {
    try {
      isFunction(this.init) && this.init(videoConfig);
    } catch (error) {
      this.$throwError(error);
    }
  }
  /**
   * call for inited lifecycle hook, which just to tell the plugin we have inited.
   */
  __inited () {
    let result;
    try {
      result = isFunction(this.inited) && this.inited();
    } catch (error) {
      this.$throwError(error);
    }
    this.readySync = !isPromise(result);
    this.ready = this.readySync
      ? Promise.resolve()
      // $FlowFixMe: it's promise now
      : result
        .then(ret => {
          this.readySync = true;
          return ret;
        })
        .catch(error => {
          if(isError(error)) return this.$throwError(error);
          return Promise.reject(error);
        });
    return this.readySync || this.ready;
  }
  /**
   * set style
   * @param {string} element optional, default to be video, you can choose from video | container | wrapper
   * @param {string} attribute the atrribue name
   * @param {any} value optional, when it's no offer, we consider you want to get the attribute's value. When it's offered, we consider you to set the attribute's value, if the value you passed is undefined, that means you want to remove the value;
   */
  @before(attrAndStyleCheck)
  $css (method: string, ...args: Array<any>): string {
    return this.__dispatcher.dom[method + 'Style'](...args);
  }
   /**
   * set attr
   * @param {string} element optional, default to be video, you can choose from video | container | wrapper
   * @param {string} attribute the atrribue name
   * @param {any} value optional, when it's no offer, we consider you want to get the attribute's value. When it's offered, we consider you to set the attribute's value, if the value you passed is undefined, that means you want to remove the value;
   */
  @before(attrAndStyleCheck)
  $attr (method: string, ...args: Array<any>): string {
    if(method === 'set' && /video/.test(args[0])) {
      if(!this.__dispatcher.videoConfigReady) {
        Log.warn('plugin', `Plugin ${this.__id} is tring to set attribute on video before video inited. Please wait until the inited event has benn trigger`);
        return args[2];
      }
      if(this.$videoConfig._realDomAttr.indexOf(args[1]) > -1) {
        const [, key, val] = args;
        this.$videoConfig[key] = val;
        return val;
      }
    }
    return this.__dispatcher.dom[method + 'Attr'](...args);
  }
  /**
   * call fullscreen api on some specific element
   * @param {boolean} flag true means fullscreen and means exit fullscreen
   * @param {string} element the element you want to fullscreen, default it's container, you can choose from video | container | wrapper
   */
  $fullScreen (flag: boolean = true, element: string = 'container'): boolean {
    return this.__dispatcher.dom.fullScreen(flag, element);
  }
  /**
   * set the plugin to be the top of all plugins
   */
  $bumpToTop () {
    const topLevel = this.__dispatcher._getTopLevel(this.$inner);
    this.$level = topLevel + 1;
  }
  /**
   * bind event handler through this function
   * @param  {string} key event's name
   * @param  {Function} fn event's handler
   */
  @before(eventBinderCheck)
  $on (key: string, fn: Function) {
    this.__dispatcher.bus.on(this.__id, key, fn);
    // set on __events as mark so that i can destroy it when i destroy
    this.__addEvents(key, fn);
  }
  /**
   * remove event handler through this function
   * @param  {string} key event's name
   * @param  {Function} fn event's handler
   */
  @before(eventBinderCheck)
  $off (key: string, fn: Function) {
    this.__dispatcher.bus.off(this.__id, key, fn);
    this.__removeEvents(key, fn);
  }
  /**
   * bind one time event handler
   * @param {string} key event's name
   * @param {Function} fn event's handler
   */
  @before(eventBinderCheck)
  $once (key: string, fn: Function) {
    const self = this;
    const boundFn = function (...args) {
      bind(fn, this)(...args);
      self.__removeEvents(key, boundFn);
    };
    self.__addEvents(key, boundFn);
    this.__dispatcher.bus.once(this.__id, key, boundFn);
  }
  /**
   * emit an event
   * @param  {string}    key event's name
   * @param  {...args} args
   */
  $emit (key: string, ...args: any) {
    if(!isString(key)) throw new TypeError('$emit key parameter must be String');
    if(domEvents.indexOf(key.replace(/^\w_/, '')) > -1) {
      Log.warn('plugin', `You are using $emit to emit ${key} event. As $emit is wrapped in Promise. It make you can't use event.preventDefault and event.stopPropagation. So we advice you to use $emitSync`);
    }
    this.__dispatcher.bus.emit(key, ...args);
  }
  /**
   * emit a sync event
   * @param  {string}    key event's name
   * @param  {...args} args
   */
  $emitSync (key: string, ...args: any) {
    if(!isString(key)) throw new TypeError('$emitSync key parameter must be String');
    return this.__dispatcher.bus.emitSync(key, ...args);
  }
  $throwError (error: Error | string) {
    this.__dispatcher.throwError(error);
  }
  /**
   * officail destroy function for plugin
   * we will call user destory function in this method
   */
  $destroy () {
    isFunction(this.destroy) && this.destroy();
    super.__destroy();
    Object.keys(this.__events)
    .forEach(key => {
      if(!isArray(this.__events[key])) return;
      this.__events[key].forEach(fn => this.$off(key, fn));
    });
    delete this.__events;
    this.__dispatcher.dom.removePlugin(this.__id);
    delete this.__dispatcher;
    delete this.$dom;
    this.destroyed = true;
  }
  @nonenumerable
  @nonextendable
  get $plugins (): plugins {
    return this.__dispatcher.plugins;
  }
  @nonenumerable
  @nonextendable
  get $pluginOrder (): Array<string> {
    return this.__dispatcher.order;
  }
  /**
   * to tell us if the plugin can be operable, can be dynamic change
   * @type {boolean}
   */
  set $operable (val: boolean) {
    if(!isBoolean(val)) return;
    this.$dom.style.pointerEvents = val ? 'auto' : 'none';
    this.__operable = val;
  }
  get $operable (): boolean {
    return this.__operable;
  }
  /**
   * the z-index level, higher when you set higher
   * @type {boolean}
   */
  set $level (val: number) {
    if(!isInteger(val)) return;
    this.__level = val;
    this.__dispatcher._sortZIndex();
  }
  get $level (): number {
    return this.__level;
  }
  __addEvents (key: string, fn: Function) {
    this.__events[key] = this.__events[key] || [];
    this.__events[key].push(fn);
  }
  __removeEvents (key: string, fn: Function) {
    if(isEmpty(this.__events[key])) return;
    const index = this.__events[key].indexOf(fn);
    if(index < 0) return;
    this.__events[key].splice(index, 1);
    if(isEmpty(this.__events[key])) delete this.__events[key];
  }
};
