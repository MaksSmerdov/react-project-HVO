
export interface CrosshairOptions {
  line?: {
    color?: string;
    width?: number;
    dashPattern?: number[];
  };
  sync?: {
    enabled?: boolean;
    group?: number | string;
    suppressTooltips?: boolean;
  };
  zoom?: {
    enabled?: boolean;
    zoomboxBackgroundColor?: string;
    zoomboxBorderColor?: string;
    drag?: boolean;
  };
  snap?: {
    enabled?: boolean;
  };
  // Можно дописать остальные поля, если нужно
}

// Расширяем интерфейс PluginOptionsByType<any> из chart.js
declare module 'chart.js' {
  interface PluginOptionsByType {
    crosshair?: CrosshairOptions;
  }
}
