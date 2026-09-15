import { createApp } from 'vue';
import { Quasar } from 'quasar';
import 'quasar/src/css/index.sass';
import '@quasar/extras/material-icons/material-icons.css';
import '@/ui/theme.css';
import OptionsPage from '@/ui/OptionsPage.vue';

createApp(OptionsPage).use(Quasar, { config: { dark: 'auto' } }).mount('#app');
