import { createEngineConfigurations, type RenderQuality } from '@hooksjam/pixi-lab-core';
import {
  EngineConfigurationSelector,
  type EngineConfigurationSelectorProps,
} from './EngineConfigurationSelector.js';

export { EngineConfigurationSelector, type EngineConfigurationSelectorProps } from './EngineConfigurationSelector.js';

export interface QualitySelectorProps extends EngineConfigurationSelectorProps {
  /** Legacy quality-token options retained for compatibility callers. */
  options?: readonly RenderQuality[];
}

export function QualitySelector({ options, configurations, ...props }: QualitySelectorProps) {
  return EngineConfigurationSelector({
    ...props,
    configurations: configurations ?? (options ? createEngineConfigurations(options) : undefined),
  });
}
