import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import About from '../views/About.vue'
import VideoCombiner from '../views/VideoCombiner.vue'
import VideoScaler from '../views/VideoScaler.vue'
import WavToMp3 from '../views/WavToMp3.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/combiner',
    name: 'VideoCombiner',
    component: VideoCombiner
  },
  {
    path: '/scaler',
    name: 'VideoScaler',
    component: VideoScaler
  },
  {
    path: '/wav-to-mp3',
    name: 'WavToMp3',
    component: WavToMp3
  },
  {
    path: '/about',
    name: 'About',
    component: About
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router