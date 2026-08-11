import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/explore',
      name: 'explore',
      component: () => import('@/views/ExploreView.vue'),
    },
    {
      path: '/explore/guide/:source/:id',
      name: 'guide-detail',
      component: () => import('@/views/GuideDetailView.vue'),
      props: true,
    },
    {
      path: '/trips/new',
      name: 'trip-create',
      component: () => import('@/views/TripCreateView.vue'),
    },
    {
      path: '/trips/:id',
      name: 'trip-editor',
      component: () => import('@/views/TripEditorView.vue'),
      props: true,
    },
    {
      path: '/trips/:id/preview',
      name: 'trip-preview',
      component: () => import('@/views/TripPreviewView.vue'),
      props: true,
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (to.name === 'explore' && from.name === 'guide-detail') {
      // ExploreView restores its own list scroll via the guides store.
      return false
    }
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

export default router
