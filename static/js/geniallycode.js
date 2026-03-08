/**
 *
 * This is a local copy of the geniallyCode.js script that allows
 * communication between the Genially and the iframe.
 *
 * If any changes are made to this file, it should be
 * manually re-uploaded to https://static.genially.com/geniallycode.js
 *
 */
(() => {
  class Genially {
    constructor() {
      this.handlers = {};
      this._config = {};
      this._connectPromise = null;
      this.isThumbnail = false;
      this.appMode = null;
      this.offline = false;
      this.isStaticDisplayForced = false;
    }

    connect() {
      if (this._connectPromise) {
        return this._connectPromise;
      }

      this._connectPromise = new Promise(resolve => {
        const resolveWhenInit = event => {
          if (event.data.type === 'init') {
            const initialConfig = event.data.data;
            this.config = initialConfig;
            this.isThumbnail = initialConfig.isThumbnail;
            this.setAppMode(initialConfig.appMode);
            this.offline = initialConfig.offline || false;
            this.updateFonts(initialConfig);

            if (initialConfig.logrocketData) {
              this.loadLogrocket(initialConfig.logrocketData);
            }

            resolve(initialConfig);
          } else if (event.data.type === 'config') {
            this.updateFonts(event.data.data);

            this.config = event.data.data;
          } else if (event.data.type === 'palette') {
            const colors = event.data.data;
            const rootNode = document.querySelector('html');

            colors.primary &&
              rootNode.style.setProperty('--genially-primary', colors.primary);
            colors.secondary &&
              rootNode.style.setProperty('--genially-secondary', colors.secondary);
            colors.tertiary &&
              rootNode.style.setProperty('--genially-tertiary', colors.tertiary);
          }
        };

        window.addEventListener('message', resolveWhenInit);

        window.parent.postMessage({ type: 'ready' }, '*');
      });

      return this._connectPromise;
    }

    set config(newConfig) {
      this._config = newConfig;
      this.fireEvent('config', newConfig);

      if (newConfig.appMode === 'editor' && !this.isStaticDisplayForced) {
        this.forceStaticDisplay();
        this.isStaticDisplayForced = true;
      }
    }

    get config() {
      return this._config;
    }

    setAppMode(mode) {
      if (mode !== 'editor' && mode !== 'view') {
        console.error(`Invalid appMode: ${mode}. Must be 'editor' or 'view'.`);
        return;
      }
      this.appMode = mode;
    }

    // This is an alias because often LLMs confuse 'trigger' and 'execute'
    trigger(action) {
      return this.runAction(action);
    }

    executeAction(action) {
      return this.runAction(action);
    }

    runAction(interactivityObject) {
      if (this.isStaticDisplayForced) {
        return;
      }

      if (!interactivityObject) {
        return;
      }

      if ('id' in interactivityObject) {
        window.parent.postMessage(
          {
            type: 'interactivity',
            data: interactivityObject.id,
          },
          '*',
        );
      } else {
        window.parent.postMessage(
          { type: 'interactivity', data: interactivityObject },
          '*',
        );
      }
    }

    playAudio(playAudioAction) {
      window.parent.postMessage({ type: 'playAudio', data: playAudioAction }, '*');
    }

    fireInteractivity(interactivityObject) {
      window.parent.postMessage(
        { type: 'interactivity', data: interactivityObject },
        '*',
      );
    }

    on(event, callback) {
      if (!this.handlers[event]) {
        this.handlers[event] = [];
      }

      this.handlers[event].push(callback);
    }

    fireEvent(event, data) {
      if (this.handlers[event]) {
        this.handlers[event].forEach(callback => {
          callback(data);
        });
      }
    }

    async loadCustomFont(fontFamily) {
      const { name, url } = fontFamily;
      const customFont = new FontFace(name, `url('${url}')`);

      try {
        await customFont.load();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`Custom font could not be loaded`, err);

        return false;
      }

      document.fonts.add(customFont);

      return true;
    }

    loadGoogleFont(fontFamily) {
      if (this.offline) {
        const parsedFontFamily = `css/gf_${fontFamily.name.replace(/ /g, '')}.css`;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = parsedFontFamily;
        document.head.appendChild(link);

        return;
      }

      const fontName = fontFamily.name;
      const encodedFontName = fontName.replace(/\s+/g, '+');
      const fontParam = `family=${encodedFontName}`;

      const googleFontsLink = document.querySelector(
        'link[href*="fonts.googleapis.com/css2"]',
      );

      if (googleFontsLink) {
        const currentUrl = googleFontsLink.href;

        if (!currentUrl.includes(fontParam)) {
          const newUrl = `${currentUrl}&${fontParam}`;
          googleFontsLink.href = newUrl;
        }
      } else {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?${fontParam}`;
        document.head.appendChild(link);
      }
    }

    setFontStyle(cssProperty, fontName) {
      const fallbackFonts = ['Source Sans Pro', 'Schibsted Grotesk', 'sans-serif'];

      document.documentElement.style.setProperty(
        cssProperty,
        [`'${fontName}'`, ...fallbackFonts].join(', '),
      );
    }

    loadFont(fontFamily) {
      const fontName = fontFamily.name;

      const isFontLoaded =
        document.fonts &&
        Array.from(document.fonts).some(font => font.family === fontName);

      if (!isFontLoaded) {
        const isCustomFont = !!fontFamily.url;

        if (isCustomFont) {
          this.loadCustomFont(fontFamily);
        } else {
          this.loadGoogleFont(fontFamily);
        }
      }
    }

    updateFonts(config) {
      const configFonts = Object.entries(config).filter(
        ([, value]) => value && value.$type === 'font',
      );

      configFonts.forEach(([key, value]) => {
        this.loadFont(value);
        this.setFontStyle(`--font-family-${key}`, value.name);
      });
    }

    setState(state) {
      window.parent.postMessage({ type: 'setState', data: state }, '*');
    }

    getState() {
      return new Promise(resolve => {
        const requestId = `getStateRequest_${Date.now()}_${Math.random()}`;

        const getStateListener = event => {
          if (event.data.type === 'stateResponse' && event.data.requestId === requestId) {
            window.removeEventListener('message', getStateListener);
            resolve(event.data.data);
          }
        };

        window.addEventListener('message', getStateListener);

        window.parent.postMessage({ type: 'getState', requestId }, '*');
      });
    }

    loadLogrocket(appId) {
      const script = document.createElement('script');
      script.src = `https://cdn.logrocket.io/LogRocket.min.js`;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        LogRocket.init(appId, {
          mergeIframes: true,
          parentDomain: 'https://app.genially.com',
        });
      };

      document.head.appendChild(script);
    }

    forceStaticDisplay() {
      const highestId = setInterval(() => {}, 10);
      for (let i = 0; i <= highestId; i++) {
        clearInterval(i);
        clearTimeout(i);
      }
      window.setInterval = () => 0;

      window.requestAnimationFrame = () => 0;

      const style = document.createElement('style');
      style.textContent = `
            *, *::before, *::after {
                animation: none !important;
                transition: none !important;
                animation-duration: 0s !important;
                transition-duration: 0s !important;
            }
            body {
                pointer-events: none !important; 
                user-select: none !important;
            }
        `;
      document.head.appendChild(style);
    }
  }

  window.genially = new Genially();
})();
