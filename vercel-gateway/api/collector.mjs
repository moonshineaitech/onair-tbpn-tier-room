import {queue,collectEpisode} from '../lib/collector.mjs';
export default queue.handleNodeCallback(collectEpisode,{visibilityTimeoutSeconds:60,retry:()=>({afterSeconds:60})});
