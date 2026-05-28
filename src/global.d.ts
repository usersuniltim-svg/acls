interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  addEventListener(type: "levelchange" | "chargingchange" | "chargingtimechange" | "dischargingtimechange", listener: (this: BatteryManager, ev: Event) => any, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: "levelchange" | "chargingchange" | "chargingtimechange" | "dischargingtimechange", listener: (this: BatteryManager, ev: Event) => any, options?: boolean | EventListenerOptions): void;
}

interface Navigator {
  getBattery?: () => Promise<BatteryManager>;
}
