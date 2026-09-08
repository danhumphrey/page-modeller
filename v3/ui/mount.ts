import { createApp } from 'vue';
import { Quasar, Notify, Dialog } from 'quasar';
import 'quasar/src/css/index.sass';
import '@quasar/extras/material-icons/material-icons.css';
import './theme.css';
import App from './App.vue';
import { hostKey, type PanelHost } from '@/host/types';

/** Mount the one panel app onto whichever surface is hosting it. */
export function mountPanel(host: PanelHost) {
  createApp(App).use(Quasar, { plugins: { Notify, Dialog }, config: { dark: 'auto' } }).provide(hostKey, host).mount('#app');
}
