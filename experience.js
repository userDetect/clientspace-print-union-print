const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const scene = document.querySelector('.motion-art');
const replay = document.querySelector('.scene-replay');
if (scene && replay) {
  let timer = 0;
  let played = false;

  function stop() {
    clearTimeout(timer);
    delete scene.dataset.playing;
  }

  function play(fromReplay = false) {
    if (reducedMotion.matches || (!fromReplay && document.hidden)) return;
    stop();
    // Flush the static state so clicking replay also restarts active animations.
    scene.getBoundingClientRect();
    scene.dataset.playing = 'true';
    played = true;
    const authoredDuration = Math.max(0,...scene.getAnimations({subtree:true}).map(animation =>
      animation.effect?.getComputedTiming().endTime ?? 0).filter(Number.isFinite));
    timer = setTimeout(stop, authoredDuration ? authoredDuration + 100 : 4300);
  }

  const observer = new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio >= .27 && !played) play();
    if (!entry.isIntersecting && played) stop();
  }, {threshold:.27});

  function applyPreference() {
    replay.hidden = reducedMotion.matches;
    if (reducedMotion.matches) stop();
  }
  observer.observe(scene);
  replay.addEventListener('click',() => play(true));
  reducedMotion.addEventListener('change', applyPreference);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (!played && scene.getBoundingClientRect().top < innerHeight) play();
  });
  applyPreference();
}

const deck = document.querySelector('[data-deck]');
if (deck) {
  let played = false;
  let active = [];
  let settledTimer;

  function settle() {
    clearTimeout(settledTimer);
    for (const animation of active) animation.cancel();
    active = [];
    delete deck.dataset.spreading;
  }

  function spread() {
    if (played || reducedMotion.matches || document.hidden || !Element.prototype.animate) return;
    const positions = [...deck.children].map(card => ({card,bounds:card.getBoundingClientRect()}));
    if (positions.length < 2) return;
    const deckBounds = deck.getBoundingClientRect();
    const topCard = positions[0].bounds;
    const visible = Math.min(topCard.bottom,innerHeight) - Math.max(topCard.top,0);
    if (visible < Math.min(90,topCard.height * .34)) return;
    played = true;
    deck.dataset.spreading = 'true';
    const centerX = deckBounds.left + deckBounds.width / 2;
    const centerY = topCard.top + topCard.height / 2;
    positions.forEach(({card,bounds},index) => {
      const offsetX = centerX - bounds.left - bounds.width / 2 + (index % 2 === 0 ? -index : index) * 4;
      const offsetY = centerY - bounds.top - bounds.height / 2 + index * 3;
      const turn = card.style.getPropertyValue('--card-angle');
      const stack = 'translate(' + offsetX + 'px,' + offsetY + 'px) rotate(' + turn + ') scale(.881)';
      active.push(card.animate([
        {transform:stack, offset:0},
        {transform:stack, offset:.16},
        {transform:'none', offset:1},
      ], {duration:920,delay:180 + index*112,easing:'cubic-bezier(.2,.77,.28,1)',fill:'both'}));
    });
    settledTimer = setTimeout(settle,1100 + positions.length*112);
  }

  const trigger = deck.firstElementChild || deck;
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) spread();
    else if (active.length) settle();
  }, {threshold:.36});
  observer.observe(trigger);
  deck.addEventListener('focusin', settle);
  reducedMotion.addEventListener('change',settle);
  window.addEventListener('resize',settle,{passive:true});
  document.addEventListener('visibilitychange',() => { if (document.hidden) settle(); });
}

const flow = document.querySelector('[data-flow]');
if (flow) {
  const steps = [...flow.children];
  let timer = 0;
  function reset() {
    clearTimeout(timer);
    for (const step of steps) delete step.dataset.active;
  }
  function advance(index) {
    reset();
    if (!steps[index]) return;
    steps[index].dataset.active = 'true';
    timer = setTimeout(() => advance(index+1),680);
  }
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !reducedMotion.matches) advance(0);
    else reset();
  }, {threshold:.35});
  observer.observe(flow);
  reducedMotion.addEventListener('change',reset);
}

const sections = document.querySelectorAll('[data-reveal]');
if (sections.length && !reducedMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.dataset.seen = 'true';
      observer.unobserve(entry.target);
    }
  }, {rootMargin:'0px 0px -6%'});
  for (const section of sections) observer.observe(section);
}

const guideLinks = [...document.querySelectorAll('.guide-nav a')];
if (guideLinks.length) {
  const targets = new Map(guideLinks.map(link => [document.querySelector(link.hash),link]));
  const observer = new IntersectionObserver(entries => {
    const target = entries.find(entry => entry.isIntersecting)?.target;
    if (!target) return;
    for (const link of guideLinks) link.removeAttribute('aria-current');
    targets.get(target).setAttribute('aria-current','location');
  }, {rootMargin:'-5% 0px -48%'});
  for (const target of targets.keys()) observer.observe(target);
}

const gallery = document.querySelector('#gallery-dialog');
const pictures = [...document.querySelectorAll('[data-gallery]')];
if (gallery && pictures.length && typeof gallery.showModal === 'function') {
  const image = gallery.querySelector('img');
  const caption = gallery.querySelector('figcaption');
  const count = gallery.querySelector('.gallery-controls p');
  const back = gallery.querySelector('[data-gallery-back]');
  const next = gallery.querySelector('[data-gallery-next]');
  let index = 0;
  let opener = null;

  function show(number) {
    index = (number + pictures.length) % pictures.length;
    const link = pictures[index];
    image.src = link.href;
    image.alt = link.dataset.gallery;
    caption.textContent = link.dataset.gallery;
    count.textContent = String(index+1) + ' / ' + pictures.length;
  }

  for (const [number,picture] of pictures.entries()) {
    picture.addEventListener('click',event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = picture;
      show(number);
      gallery.showModal();
    });
  }
  back.disabled = next.disabled = pictures.length < 2;
  back.addEventListener('click',() => show(index-1));
  next.addEventListener('click',() => show(index+1));
  gallery.querySelector('.gallery-close').addEventListener('click',() => gallery.close());
  gallery.addEventListener('close',() => opener?.focus({preventScroll:true}));
  gallery.addEventListener('click',event => {
    if (event.target !== gallery) return;
    const bounds = gallery.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) gallery.close();
  });
  gallery.addEventListener('keydown',event => {
    if (event.key === 'ArrowLeft') show(index-1);
    if (event.key === 'ArrowRight') show(index+1);
  });
}
