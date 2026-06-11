import { Sandbox } from './Sandbox';
import { StudyFlow } from './study/StudyFlow';
import { DEFAULT_CONFIG } from './sim/config';

const config = DEFAULT_CONFIG;

/**
 * One switch: the single-page sandbox (Version 1) or the multi-step study instrument
 * (Version 2). Driven entirely by `config.ui.flow`, so a "version" is a config, not a fork.
 */
export default function App() {
  return config.ui.flow === 'study' ? (
    <StudyFlow config={config} />
  ) : (
    <Sandbox config={config} />
  );
}
