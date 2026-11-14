import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { loadSettings, applyInputAliases } from './lib/settings';

const settings = loadSettings();
applyInputAliases(settings.inputAliases);

const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark);
document.documentElement.dataset.theme = dark ? 'dark' : 'light';
document.documentElement.lang = settings.lang;

const instance = mount(App, { target: document.getElementById('app')! });

export default instance;
