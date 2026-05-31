import { initRouter, defineRoute } from './router.js';
import { renderHome } from './pages/home.js';
import { renderFootprints } from './pages/footprints.js';
import { renderStats } from './pages/stats.js';
import { renderMe } from './pages/me.js';
import { renderTripDetail } from './pages/trip-detail.js';
import { renderDayoutDetail } from './pages/dayout-detail.js';
import { renderNoteDetail } from './pages/note-detail.js';
import { renderEditTrip } from './pages/edit-trip.js';
import { renderEditDayout } from './pages/edit-dayout.js';
import { renderEditEntry } from './pages/edit-entry.js';
import { renderEditNote } from './pages/edit-note.js';

defineRoute('/',                            renderHome);
defineRoute('/footprints',                  renderFootprints);
defineRoute('/stats',                       renderStats);
defineRoute('/me',                          renderMe);
defineRoute('/trip/:id',                    renderTripDetail);
defineRoute('/dayout/:id',                  renderDayoutDetail);
defineRoute('/note/:id',                    renderNoteDetail);
defineRoute('/edit/trip/:id',               renderEditTrip);
defineRoute('/edit/dayout/:id',             renderEditDayout);
defineRoute('/edit/note/:id',               renderEditNote);
defineRoute('/edit/entry/:tripId/:id',      renderEditEntry);

initRouter();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./service-worker.js').catch(err => {
    console.warn('[sw] register failed:', err);
  });
}
