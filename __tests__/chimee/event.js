import Chimee from 'index';
import { bind } from 'chimee-helper';

describe('chimee event method', () => {
  let player;
  let originCreateElement;

  beforeAll(() => {
    originCreateElement = global.document.createElement;
    global.document.createElement = function(tag) {
      const element = bind(originCreateElement, document)(tag);
      if (tag === 'video') {
        element.play = function() {};
        element.pause = function() {};
      }
      return element;
    };
  });

  afterAll(() => {
    global.document.createElement = originCreateElement;
  });

  beforeEach(() => {
    player = new Chimee({
      // 播放地址
      src: 'http://cdn.toxicjohann.com/lostStar.mp4',
      // 直播:live 点播：vod
      type: 'vod',
      // 编解码容器
      box: 'native',
      // dom容器
      wrapper: 'body',
      plugin: [],
      events: {},
    });
  });

  afterEach(() => {
    player.destroy();
    player = null;
  });

  test('emitSync', () => {
    expect(() => player.emitSync(1)).toThrow();
    expect(() => player.emitSync('click')).not.toThrow();
  });

  test('emit', async () => {
    expect(() => player.emit(1)).toThrow();
    await expect(() => player.emit('click')).not.toThrow();
    await expect(() => player.emit('play')).not.toThrow();
  });

  test('once', () => {
    expect(() => player.once('hello', function() {})).not.toThrow();
  });

  describe('on', () => {
    test('on error check', () => {
      expect(() => player.on('hello', 1)).toThrow('fn parameter must be Function');
      expect(() => player.on(1, function() {})).toThrow('key parameter must be String');
    });

    test('on normal function', () => {
      player.on('hello', function() {});
      expect(player.__dispatcher.binder.buses.plugin.events.hello.main).not.toBe();
    });

    test('on with custom target', () => {
      player.on('hello', function() {}, { target: 'kernel' });
      expect(player.__dispatcher.binder.buses.kernel.events.hello.main).not.toBe();
    });

    test('on with custom stage', () => {
      player.on('hello', function() {}, { target: 'kernel', stage: 'after' });
      expect(player.__dispatcher.binder.buses.kernel.events.hello.after).not.toBe();
    });

    test('on with custom stage described by name', () => {
      player.on('afterHello', function() {}, { target: 'kernel' });
      expect(player.__dispatcher.binder.buses.kernel.events.hello.after).not.toBe();
    });
  });

  describe('off', () => {
    test('off with non exist events', () => {
      expect(() => player.off('hello', function() {})).not.toThrow();
    });

    test('off from real dom', () => {
      const fn = () => {};
      player.on('click', fn);
      expect(player.__dispatcher.binder.buses['video-dom'].events.click.main).not.toBe();
      player.off('click', fn);
      expect(player.__dispatcher.binder.buses['video-dom'].events.click).toBe();
    });

    test('off according to stage', () => {
      const fn = () => {};
      player.on('click', fn, { stage: 'before' });
      player.on('click', fn);
      expect(player.__dispatcher.binder.buses['video-dom'].events.click.main).not.toBe();
      expect(player.__dispatcher.binder.buses['video-dom'].events.click.before).not.toBe();
      player.off('click', fn, { stage: 'before' });
      expect(player.__dispatcher.binder.buses['video-dom'].events.click.main).not.toBe();
      expect(player.__dispatcher.binder.buses['video-dom'].events.click.before).toBe();
    });

    test('off according to target', () => {
      const fn = () => {};
      player.on('click', fn, { target: 'container' });
      player.on('click', fn);
      expect(player.__dispatcher.binder.buses['video-dom'].events.click.main).not.toBe();
      expect(player.__dispatcher.binder.buses.container.events.click.main).not.toBe();
      player.off('click', fn, { target: 'container' });
      expect(player.__dispatcher.binder.buses['video-dom'].events.click.main).not.toBe();
      expect(player.__dispatcher.binder.buses.container.events.click).toBe();
    });
  });

  test('passive event', () => {
    expect(() => player.on('touchmove', function() {})).not.toThrow();
    expect(() => player.off('touchmove', function() {})).not.toThrow();
  });

  test('self processor event in emit', () => {
    const fn = jest.fn();
    player.on('beforeSilentLoad', fn);
    player.emit('silentLoad');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('register a new kernel event', () => {
    const fn = () => {};
    player.on('test', fn);
    expect(player.__dispatcher.binder.buses.kernel.events).toEqual({});
    expect(player.__dispatcher.binder.buses.plugin.events).not.toEqual({});
    Chimee.registerEvents({
      name: 'test',
      target: 'kernel',
    });
    player.on('test', () => {});
    expect(player.__dispatcher.binder.buses.kernel.events).not.toEqual({});
  });
});
