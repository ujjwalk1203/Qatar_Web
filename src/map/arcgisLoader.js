let sdk;
export function loadArcgis() {
  if (!sdk)
    sdk = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.arcgis.com/4.34/';
      if (!document.getElementById('arcgis-theme')) {
        const theme = document.createElement('link');
        theme.id = 'arcgis-theme';
        theme.rel = 'stylesheet';
        theme.href = 'https://js.arcgis.com/4.34/esri/themes/light/main.css';
        document.head.append(theme);
      }
      const timer = setTimeout(() => {
        script.remove();
        reject(new Error('ArcGIS SDK timed out.'));
      }, 10000);
      script.onload = () => {
        clearTimeout(timer);
        resolve(window.$arcgis);
      };
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error('ArcGIS SDK unavailable.'));
      };
      document.head.append(script);
    }).catch((error) => {
      sdk = undefined;
      throw error;
    });
  return sdk;
}
