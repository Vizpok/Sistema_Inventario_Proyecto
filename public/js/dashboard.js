/* Gráficas del dashboard (Chart.js). Colores leídos de variables CSS para respetar el tema. */
(function () {
  const datos = JSON.parse(document.getElementById('datos-dashboard').textContent);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const compacto = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });
  const diaCorto = (s) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  const graficas = [];

  function comunes() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: {
          position: 'top', align: 'end',
          labels: { color: css('--texto-2'), usePointStyle: true, pointStyle: 'line', boxWidth: 24, font: { size: 12 } },
        },
        tooltip: {
          backgroundColor: css('--tooltip-fondo'), titleColor: css('--tooltip-texto'), bodyColor: css('--tooltip-texto'),
          borderColor: css('--borde'), borderWidth: 1, padding: 10, cornerRadius: 8, boxPadding: 4,
        },
      },
      scales: {
        x: { grid: { display: false }, border: { color: css('--borde') }, ticks: { color: css('--texto-3'), maxRotation: 0, autoSkipPadding: 12 } },
        y: { grid: { color: css('--rejilla') }, border: { display: false }, ticks: { color: css('--texto-3'), precision: 0 }, beginAtZero: true },
      },
    };
  }

  function dibujar() {
    graficas.forEach((g) => g.destroy());
    graficas.length = 0;

    // 1) Entradas vs salidas (2 series: slot 1 azul, slot 2 naranja)
    const base = comunes();
    graficas.push(new Chart(document.getElementById('graficaMovimientos'), {
      type: 'line',
      data: {
        labels: datos.serie.map((d) => diaCorto(d.dia)),
        datasets: [
          { label: 'Entradas', data: datos.serie.map((d) => d.unidades_entrada), borderColor: css('--serie-1'), backgroundColor: css('--serie-1'), cubicInterpolationMode: 'monotone', borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: css('--superficie') },
          { label: 'Salidas', data: datos.serie.map((d) => d.unidades_salida), borderColor: css('--serie-2'), backgroundColor: css('--serie-2'), cubicInterpolationMode: 'monotone', borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: css('--superficie') },
        ],
      },
      options: {
        ...base,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          ...base.plugins,
          tooltip: { ...base.plugins.tooltip, callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y.toLocaleString('es-MX')} uds.` } },
        },
      },
      plugins: [{ // línea guía vertical (crosshair) al pasar el cursor
        id: 'guia',
        afterDraw(chart) {
          const act = chart.tooltip?.getActiveElements?.();
          if (!act || !act.length) return;
          const x = act[0].element.x;
          const { top, bottom } = chart.chartArea;
          const ctx = chart.ctx;
          ctx.save(); ctx.strokeStyle = css('--borde-fuerte'); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.restore();
        },
      }],
    }));

    // 2) Valor por categoría: una sola serie, un solo tono, ordenada de mayor a menor
    const b2 = comunes();
    graficas.push(new Chart(document.getElementById('graficaCategorias'), {
      type: 'bar',
      data: {
        labels: datos.porCategoria.map((c) => c.categoria),
        datasets: [{ label: 'Valor', data: datos.porCategoria.map((c) => Number(c.valor)), backgroundColor: css('--serie-1'), borderRadius: 4, borderSkipped: 'start', barPercentage: 0.7, categoryPercentage: 0.9 }],
      },
      options: {
        ...b2,
        indexAxis: 'y',
        plugins: {
          ...b2.plugins,
          legend: { display: false },
          tooltip: { ...b2.plugins.tooltip, callbacks: { label: (c) => ` ${moneda.format(c.parsed.x)}` } },
        },
        scales: {
          x: { ...b2.scales.y, ticks: { color: css('--texto-3'), callback: (v) => '$' + compacto.format(v) } },
          y: { grid: { display: false }, border: { color: css('--borde') }, ticks: { color: css('--texto-2') } },
        },
      },
    }));
  }

  dibujar();
  document.addEventListener('tema-cambiado', dibujar);
})();
