import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import About from '../views/About.vue'
import VideoCombiner from '../views/VideoCombiner.vue'
import VideoScaler from '../views/VideoScaler.vue'

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