// Переключатель "Пометки видны / скрыты" — тот же приём, что в
// каркас-главной-v0.1. Один файл на все страницы каркаса.
(function(){
  var b = document.getElementById('tn');
  if(!b) return;
  b.onclick = function(){
    var c = document.body.classList.toggle('clean');
    b.setAttribute('aria-pressed', c ? 'false' : 'true');
    b.textContent = c ? 'Пометки скрыты' : 'Пометки видны';
  };
})();
