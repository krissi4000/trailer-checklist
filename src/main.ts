import './app.css';
import App from './App.svelte';
import { registerSW } from 'virtual:pwa-register';

const app = new App({ target: document.getElementById('app')! });

registerSW({ immediate: true });

export default app;
