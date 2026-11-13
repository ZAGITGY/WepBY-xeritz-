/*!
 * butterflies.js — ฝูงผีเสื้อเพชรบินผ่านหน้าเว็บ
 *
 * ใช้: ใส่บรรทัดนี้ในหน้าเว็บ (ใน <head> หรือก่อน </body>) แค่นั้น
 *   <script src="butterflies.js" defer></script>
 *
 * ปรับได้ (ไม่ใส่ก็ได้) ด้วย data-* บนแท็ก script:
 *   data-count="20"                จำนวนผีเสื้อ (ค่าเริ่มต้นปรับตามขนาดจอ 10–24 ตัว)
 *   data-stay="3"                  จำนวนที่ยังบินวนอยู่หลังฝูงออกไป (มือถือใช้ 2)
 *   data-duration="5.5"            วินาทีที่ฝูงบินวนก่อนเริ่มบินออก
 *   data-colors="pink,blue,white"  สีที่ใช้ (pink / blue / white)
 *   data-autoplay="false"          ไม่เริ่มเอง รอสั่ง Butterflies.play()
 *   data-z="2147483000"            z-index ของชั้นผีเสื้อ
 *
 * สั่งจากโค้ด:
 *   Butterflies.play()     ปล่อยฝูงใหม่ (ตัวที่ยังอยู่จะบินออกไป)
 *   Butterflies.release()  ให้ฝูงเริ่มบินออกตอนนี้ (เหลือไว้ตาม data-stay)
 *   Butterflies.stop()     ลบผีเสื้อทั้งหมดทันที
 *
 * ชั้นผีเสื้อไม่รับการคลิกหรือแตะ (pointer-events: none) จึงไม่บังปุ่มหรือลิงก์
 * ถ้าผู้ใช้ตั้งค่าลดการเคลื่อนไหว (prefers-reduced-motion) จะไม่แสดงผีเสื้อ
 */
(function () {
  'use strict';
  if (window.Butterflies) return;                       // already on the page

  var script = document.currentScript || {};
  var data = script.dataset || {};
  var noop = function () {};
  var api = { play: noop, release: noop, stop: noop };
  window.Butterflies = api;

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (mq && mq.matches) return;
  var probe = document.createElement('canvas');
  if (!probe.getContext || !probe.getContext('2d')) return;

  /* ---------------- settings ---------------- */
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }
  var CFG = {
    count: data.count ? Math.max(1, Math.round(num(data.count, 18))) : 0,   // 0 = by screen size
    stay: data.stay != null ? Math.max(0, Math.round(num(data.stay, 3))) : -1,
    duration: Math.max(1, num(data.duration, 5.5)),
    colors: (data.colors || 'pink,blue,white').split(',').map(function (s) { return s.trim().toLowerCase(); })
      .filter(function (c) { return c === 'pink' || c === 'blue' || c === 'white'; }),
    autoplay: data.autoplay !== 'false',
    z: data.z || '2147483000'
  };
  if (!CFG.colors.length) CFG.colors = ['pink', 'blue', 'white'];
  var COLOR_SHARE = { pink: 0.45, blue: 0.3, white: 0.25 };

  /* gem butterfly, top view, head up, body on the centre column (256 x 185) */
  var IMG_SRC = 'data:image/webp;base64,UklGRnBEAABXRUJQVlA4WAoAAAAQAAAA/wAAuAAAQUxQSOUQAAARsMb+v/Om1fmfIzux4kTOsjKUMDQVKEqXwtLSKgpt0wHpUihodm8xBe1FvZR0IMrogjvQ1LpoKnQoDIWlLqUNUQgyGVYS5BAiJ7Ee24/OOf8XLPt5/jbSfRURE8D+3z67JMfjckA8ABhjAA8ccJsAxpbpvvp961/yQkyEp+ylWY/Pqpo/47GJUx8dM8wDrjRxG/CkDO6UnpXpGVb6cGllZdnC6o8XnfKZiNj+CLtv7hoxZ85zX97obL0RMPr+qP+73tfVfOSztSvemP9kibfQm8IZh2QKIKVg6COvPL14w6GjF+rrr7Vdujnw12+1F0OR0xJRX3027T5E+ogVZ9p/PV4flVppxGCfQkSNt9oDwebzNQcvnXjz2YlFHhckQwAZOYWPDx82q+bKmWBn4wBKQyKiRAwHzX5pICLKsP+DjHsB15CK/UGpEbXG+9QaUfYPRLTsaavbvX7R6FwnA4DkBRgTg5Z/+8WO7RveXrQ7HFGyT2KMdeBV1z2klr51Iaox7kqHb3XU7FkwZUi6E5ITEDklL1b/FLhwKWzc+PbAJY3x1LprofNunsnf9mi0pFZR1XXlwJqKYU5IPkTehPd3Xg6YRtCvEcP7Md5aXxxzF/FQ+YWoRW7Xyuht/POrZcPcApIHcGSOXX2kpS+iEFEjIsqgjhfq8AZxJ/fE1wIara1Mw1+z9ZXitOQAuLdsRU1Tv0SL64jPfae0wR8OWA0RlTQ79nxYliUSX8rgyh2/9Rgyoi1n9sy8S9HGAbSlNgYad5bnuiCRcffYTy53DphKo0bLy1DVnVzeLwx73B7xH3ptuAsSlcic+tnvhtIa7Sn7n+N3SHXtlPbRMtR+9K0CSExpM7b/3aekRrvKUJW4AzgrDvhtg4haBc+tHeGCBAOO/Nm7AxGl0c7BKnZHDs4RtXZCVOHAyfdzEovwTNjeZEiF9u5++k6MwdAGeyGi7D00N4MnDJE6etXlASUV2rxj3N2cq0O2Qx317yrPhoQgPGMWnR0wJdq/Z8RdYPANbT9EHW7aPioRuEtf3Hc1IjXaX15LuxMXw1uRyOjRuV5BnLPw1ZrGYFgjheEDcCcGnjNUaOOvfeMEZdz9+Pq/wzKskUIZWC/uIuAEFahN/VO5ky6Hd8pn16VCInX/m3AXDm8oKhCVbNs81EETzyh982LwOtIZmMTuDk9KOlDLmwemp1DkyJ++udFUETp0w0i4C8CoekIQtdFU6aYnZcSLR4NSI6HmyTx2N+HZYVKCWvdsGAa0iJyydfUSae390HU3xp0vdZOCGPb/e4SgRBTP2eSPIq2ytVzcA+OZ3xKjZc++aSlkgGv485uum5oWLY/kwL0I1ydak4IoQ5cWpBEB7tJXtlzoNJFUffPUOHbPXMweQGq16VvqIQHSH12yszlkIq2yYXX6vQmedT4QIgYx2lbtBQK80z74sUsitTqynt07CPjUHyRH677qIgKGbvzxpkJ6fbPvg3F4yUCCdfD7Ivu51/YqpFft8d4Pg6IjUtODOnp0CLcRCG/G6OP/6USCB94V9wPc+XafIgi1sbNE2Mc5aFbhPuwdoOj6JHbfnD9ajyTr8JFxqXZxlby89sVN3SZSfMh7fwCOLYfbKUIz3LLMA7ZIK1934CZKU1GkVjrvjwkxclIDSb0Npm+qLVIfX91kaCT61iQWS1F2JqopUrJj11t5YD3+8JpTwShSfbkwJuD9BYnWvf5P88BqKUNe/L6l4SZV+khWTFjW5ghRqOTNtW5uLTFy2Vd/y6gk67OU2PBlMkoUojaqXdYa+sbRMNKt2+bw2IiFpw/RJbsqHFbyvLTDj5T5pkJseF7hR2ShitZOFNZxj994wVCEybOjWIyF4wBdqPoPjrGMs/TlTb8HKAvs8kKsHq0nDGX/8RyLQH75+tbOeiT8+IsuFqtFS/yEoY5u8lgCCqcsOhdWkrDI12Us1qkvrzlNGWLnAmEBKKr46FxbUCPh0QPDYgV8Ti/Sbv4y2gKueev2R8IaKddXx8aKwfi/FG3K+NQTt/SZH288i9RfHxQznvubpg3lz3PdcRLjNmx7/yJ1aocjViAyLlOnfZfm8fh43tz515FW6m6+wWIOKdWSOOwPNY6BeIjJ6/b1DkjiVGNF7ARfeEsSh8r8Li8OvPidnb5QFKm//Egc4LEG8lAGPkyLGeS++OXvEY3UyxPFsQORV0MfqobJMXOUr6zpVUh++Ct3PNKqw/Sh/G96jGDUB9vbTE1fcD6PHROORT2aPgy/44wJz1+6tVkqpN83nsUR+PhGrenDhvEQC9fstcf6tE4AdcXxYDzraEIwD3hi4X3+H42mQvr1O474wEdSJgAMLnXcyZGb5UmF21LnvVETxUTYU8biCny0qRIBnh8Lt2W/v/PdjxeXMMYcE9b9cCmUEOpc8WHgPJgYQv9wg8szfPn1wM+BnqMTHCne5z65aMhEIKtZnDnMC0idAIJvuTNfXrJob3ckgjr686jJaz/Y3aMxETZOjZsoPhlNBFfK359+6tqpgERE1P3rvq1b+RcmxMjmjHiB4FU3E0F3q3mgMYR37+n1/3YpmBD+nMLiDryoNhEgYsRU94AoZW9/IlDV6RYQYn5IJ4TE3DaJWRB4+t7og0roE5cVGBdPNMkHE3X6YbAEE+lrQ/qBpPN5wSwiBp3FB1FzWy6zKBdibocpHzS0ulDKLAvCtcT3wIGNs4V1GBee1UGpHyw6X3UxKwPP+MqvHiS0f7WLWZtz79Z+9QBxfZGLWRw4z13TLtWDQbT/alU6WI0xLtzT/9nQL3Xypzo2T3IyOwKH9FV9aKjbdLKmpTR+XzFEMHuCcBY++2lNW69GNEIBnTQpEzHSrTEsEY22C9ufKxbMruAQzsxhEz/cerDutz//c72tq6e7xRcwjdakREaa/KhMQ6nuX1v+rNt2+Urtb3U/bV/x5EiPYHYWaalOT/6gCRWTs8uemDv/jaVLV3y36ZP2Dr//Rm8kmkzoSGDnmxfPnDhw7NTu9dPzK5Ytfr9q/pKXyx8tcACzN3AhUtJyh432QEpmbuGwUSPzs3NHT3/++ar3d6lkInRl34oZCyomPP3ctJc+Ggbjnx0/b8aoR0dkuIBRyQVjjDvdmXleh9PpTnelTO7EZLL/at2yMWWTB4+amF00pjw1xSucqcBoBs4YA+FwvtSbVBgXF4x1pGZwcDDGgCVE8K4LJxGhXVUuYAmV55RtbtVJhKz/z7O5kDiA583b0SQ1JpNmqO3byWk8IQBPL113sSOIyaf/i+OvDRL0OfNnrzrXJ6VOQow6DBxe5KUNUvKe3tvUMiAxOZWI0Rv/m55GF8+as6W2XWpMajX6PxtGFDiLN/ijGJGY9EZq384lCBwFU17b/WMQk2Id2DEUqHHmT9ly7mhNg5kcySuHq8pctLgeWlob0loqTJLDXc2/rXITAt7yzQ1RTK617P1+QioVonDe976wSrIQ1cDpeU4aHEMW7m4Ma0zCZX1lGgV8ZNU2vwphUm60L/fYD7yvVP8uMVmX/iqwneeJtb8YmLRrfXyS02Zi5Ktf9+jkDfFM3RSbZVUs2XYLk/nf5E6wV3HllprWpE5iR6m9vJNqfbeSOkTzY5etMir8EZnk4dkSO0Hmiggm+2bvMoed3BvNpA/1Vy4bMW+NSv7UoRwbiaILOvnDcwVgK/kAUJvP7Asl9eoB4PJI+wCU1AWSP32myEZiyK9G8hfdkw02Krqskr+BDenMvpD5Qzj5C36QaiOe8m6zmfS1zhE2Yo6SuT6ijK4biErdw43maIQofaKQ2Vlk/DOqaLr59QbE1j/kbbq7Kbhn/i/NiqitHlvx1O1K0xTanPvs6n/+jreH95V6s7KORTVNcgHYijmXU3W+lDE2/tod+v9XwkB8LWnS/hKbiRmapsgXbsag5FT0Nnm5hAFMaFY0Xc20GRvsQ4o76oaCi/GinYZGRKzJYSDSPrmlKTL+w+zurFEE6a71jAHj7m2mQsTIOsEY52MvGJKgnrcZ2IyvMzU52rw+hzHGuJjZNRBVsr6IMcaEWG1S1DSL2R1mXIvQE96Tx4Ax4I5ZW0/XbS5jtwMvaVf0qIMFtmMl5w1yMDBfsDu6CsvKH/bAXVzV/YqcgbUu+2V+aUhqIvuL4U7clZuXAuzOnJee7ZXU3HoV7Odc3BHWxHS9wllsecqCgKbmt7EEiFHbI9QcK2YxBj6oKaKIOexl9gfnbknLwK1KiBUX4p3+MC3RdxwU8Od7IqSED3lZzDkfdlbS0voQowBGN0tKdFuViB2Ac1mPIqWugATu/h8p4eUZLI7ABx/VlJhfpVLAuHh3QBFyvZTHRaS83OWXdHRVChKAT/cpTUb/cieLK/DMV7aFyJAXRzMiCo+GIlT0HxwG8WEMJl5BMs3qNBoYd6wyJA1KNj8tWNy830bICL3MqeATOpDGvtpFHmbB0sv9mohrIxiV3FVLQ/CvLUOYFUVlnylJUDucdPB3FAWy6b/jhRWAe77vMUgILmaElDZo+0V+a1ruYpYEGHkiqgjQF4fQAcKzxbCf6j1QBNZgTFR0UxD9wUMJr/Bru2ltLAVmWVdNWNrvRpWDDgbCe9J2MrilgFkXxtRKbTddO5hRysWbWttLRk8NYlYS05vRdpuctPBBzWhrKa9OZpYGPueW3W5MZaSCgO2mnZTsegusJlZ3a22rmhxaGOdTW5SdjK1eZnHgeVvCaGMdfVtQIzzfmzaSu7KZ5YEVnrCR6tpdzKjl4gmf1naRf5QwO8KoWmkb6V+cSg5wx7N+W+g+v6/uKWEL7hi77ecmaQ/0PQ7kMA4ZJ6Ud8KuKsV7BbAlCZJQcMGzyfSajF0RGrbZFbUU6MJuC4I9esYfungwkibcMG2jpmwPMtgBiep1hAy1rPYxi4MN/0dbDyKZCZmcuynttgIEPnCQx7lhmWM6Ql4eDrUC41g2Eo9pi+udhQBPwzHOmtJYOH36MM3sDz57/Q51hLd1T6WBEc1jYa7WLZZzZHSDlqV7E6IB15MAxDyNL5B9XVtLm5fGc2Z9zz/qT61c+ax3d+iKjW4in2q0UPTZRMAo5d2YUftBlneh/cwkD8O60jEa8MkUwEoExtsgvreMrdxDGQIzvsoppXpjEGZk8Z+62482GJXR0lYuRxsWOiDU0/jRRMEoBMmf6LKF+LWLUT27UVlDqwiOC0cJHH45YQbXOZ9RD2sp2GT9t7B/DyM1662ogFC8d8n/kJk8I7/agjpOUAz+MEORwSKs4HJBxMm/sHQzkgeDT25WOi+r3b/QCIxgcMy/1dMq4qNYJnNEPPHVNIByH8IDZtTyb0czhkeqaYFw633CwRAii+LuwjpkO1599J5sRDUIMW9+p42CsyWaJkYuhJ00VI2mo/Y+7GNnAecHGPlPGRsreFS6WIEFA2Y+RmyF9X1praRwtEYxw4Nz14bXY6J76t92QKBhwUXp+k1/dl5Lhnz4qEUAZY5ynVdQYOhatc90sgQIXWR92GHeTUUSto72X1oxKE4x6YGzQ2j+iMqruRWntW8ASLBd5846ZqBFRat+23Shv1H3xVHEKsAQIPG3K1l27++6kERE76xdmJRrGmKOg8uu/OwO9Xzedn/5q29EPnhqdLlhi5FzkeEZc6g519oW02Rfw7Vr0mAsSEDhc7odmV/1nfuUjpSvemTncI1jiBIfTUzxt1fbDh2sPbfng+Yc8wBIyF0K40h6bWzZo7hvDcwRLqOBI93hHTHtu9pzKpx4pSgWWuAFSckpeykwHYIkWQLjyH33Uk+1xAvv/TgBWUDggZDMAAHCjAJ0BKgABuQA+MRSIQqIhIRXptqQgAwSxAGgpMv9j610Pfs/yq/mHvF2z/Mfi38lujMtDzHOcP+H90PzD/3vq6/UXsC/qX/zP8F/cPgZ6S/7r/3vUH/Uv9D+2XvA/9D9gPdL/bfUA/rn+89af1Kf3l9gD9rfTh/cz4O/7J/xv3M+BD9oP//7AHoAdRP0T/lP4q/q58cu+D7p+Lf7nerf4r8x/eP7f/kf9r/avam/y/EL6V/J/6/0U/j/25/J/3j9z/8L+8/yl/vv7p4t/FX+3/Mj4CPxz+Wf4/+x/ud/jfgb+W/5neCbH/p/+76hHsf9Y/5f+K/eT/Dem5qle7X5D/ne4F/Kv6T/wP7j52/hseVewF/Rf71/1f9V+VX0q/23/l/0f+0/dr3K/n3+b/8f+Z+Ab+Vf1P/d/3//Rf+//Q////xfer7YvRL/Wb77kdRFnrSq5nn39mGuQJ0kv8nnEkCdnBaSW43OVh5+PuV7hT+BuWvhYRZr7wdpFF0IX7E5eWVavG6BLxg5egUjIqfL7HXzrw+EnSgL6TJnr8dr91ZNxHp4unYn56EjIMwJVGfnnAwQ0DizMIqNInDozrOApp9gqdRgrZxmq5uwwrk0fsKmmRQpj1C8CtQLtuHpAOHnyk16g0pWjbEFt0Uwr7Yu43C18+IYW97pJKK3rLbURW5r4jWEciYl7VWuNhdECVcpUZwoszVi1aJuSCGL6cxiOntE1byeUS/nQwucqF31ZuFu5Z8FpzWbPWqHvWLfVEl7CS+RXq9PS549Yo6NJRtUrnjuw3Z+T2eGZsweV1K39hF7GnGDZxttlITNUQzOqX6nR8hkXXQiUkkjs23at0xJZ4GvbWSGuoBn70zt8uwkDbLa0uU5WqtaJ+W7ehMfFCEiVHP9yFMsjvi4V8Hdjg2usME4Zue8ZFEEXUarnTQtWtw0GH3EKEo/OblwSihvKM/ykcflEn4tZWmleD0H2j4iJ4cVUsqQrA7uC8LMg4GMbHpiVXu+2YFf/78e2SjPaZ4c9o3TJ2IdDVZZe+V0HpsEmpjIa0CEjeRCdTF6IOOUIVPaAFgF/kkcWPdIenTP/YD34R8gAaGTrZ9Mwba6yx5Jejr8ejCQmm+zr2XjdCNKNXh6xF+dpW9dcINFLB8zRi28ts5h937yWHxxHaj7VIgitafI4+tNe+O2v5SrmKvcNKQB6XLvTgIt630UpUTVwzTMQvGV7nu39L17O0PfkkFfE65oHTZ3dt3EWUEufZZGShV74l65Re3LsabszNhV7GbFINr31Z6+su8a8nJ/oT8FGL3c2Tj2nNJMWDblS3G03OKMqc61gxQgesX6M6vGP7+VDqZBDBNg/dSf0RyKxcXwrlNCWY1a9y6pmYcQhiIT8g+T3XkXbkcFJcwX54vJHMYEeztIlm2Ulpg8q83Mr7KVKPv+Ky5f+tYu4p66K0PYScADjjmFd+5ZjzrHuWAvGAhI7sykEbknuBxpj4IHcaniQkbQ2vv8WoaM/e80gldZe1Qz3PCDQmXVrlpfyIW8hdVBysGZQiRMdHldd7VMNgrq0/6hpzJdnJgSrROxpbQBYSfbXYZIF+8DGMMkYQS+3ic/3p/rAMfIVbb9qIoB1cXDiUdn8il1LfA1TtWWX04HGGWvtA+eSwzI20wMiXlXOjbgdijQfufiDpxw72+2gHvsVnxC5FaniRv95xl+AIXqVwGyXtLvX7ZF+2DEJlDO+Ax6fSVlZWc00RH/nNxv8s3OfmqnAAPUG5bD4JTjrbBwoIj2J12TRFmtGIfuhO5SEMUW+w/9+Mk1lVw7VQDokD1XQjf9YBzMjBTMQG7k7PXEP8Waz3HO5n8ml1r5PJaxYarxfnqt+JzYmtspjlsQFpXp79pauB5/z3/xpAtPV6/V/9/xyzPK7DTz+J2JTENg6oYkTd3ObWDw7YrRh7nmaoPq68R7FUo2OQzcfTkMr8W7ZLWOZdAlUbL87lB5SAVwfBOZDdWciH8ivgStloFceUfd8Zv4xVl+5HU8mZ+tkkKxSOB0/1Odo1OFFYlWfomXuPky41WjJn4+PUPl4XOmtfUxyPXFI2/uiYwg0gqVuMYmLlorsKSPQCehGhn5jbqQJomBgA+cJlkM6yKZTGSTBszjaPcTn93Fv0aWG+Eqqw1iJZ33Rz9pca95yDcsKPG2LNqeLPoMK1h7SDFMxipC5L75LW8lML5UZa05gAABffJQX731ELLcjK7pFQZ/wn3Nzej8PgA+CTEXJMe7X1yxI72RipvfIaazs48XaQfj8e689eUdvSn/blaLWiIYnRKCFpIE4gAg8560AZ+fo2jcO4SLz/Fh8rv3W83huf90nK/LxslXy/P9nu/WpRZ1d6V4X/w194NoRVpduwoWHXLSD2dW4e3hCBEgX8EovZCNgNNDsk+B6NFA+CnGMroWqQBWoZWMTo4kkI3BQCwOqUxQ2I2KQdZwhrd0eAnrLc/934sf3A33RaZHdJoy2XaYCSk8LhgjCx6HBAi1dsf1A/hoXGYVvWGu8/Pi6u0/YIhtjjK0kozSsE3GH32S+BlY/s+5cyjaEmG4xEv2MPebAMmCWenlwZcwbfeo/wKgxMWlcTLQ3bi3d645o9g2bgD6FjdgpvpnR5wVj7ZvgQDCNIM48E78RfXGvGENHU4fOktFkI6KwEdyQYIH9HBPrBWWjGq8OoEg7CV8xNmSo7LJu59Zf7uoOERzlQPcgOIiKzrQJoKx0FYJgH1PXgVZ6uW9nFZLTYLNmJRfQ2n3nRn8cSnlV1lD8VcJ5Luo972hOVS+n4IZuj0QPfxQItVqbvp/0LbFKFfu4bUbUPur6qJav9ZtcWthN41ebJ+Ds+rkQYhPc6hJUcqmzOfIxoFIgLxqz6URjVfxbEoFozNGAwnzImJ1Fx6agyE2DYiCy2JivcxyBkFaqYVn5QXkxduOi3PZ2TIdTNgh1MBMgoYarJWbrxIP6ObYQqMIAN5J/0fVIADwEqHdZsRfqXHDgwD9OuNUW4DgOjSkQeo5MhjFpYP+TMx0ELwVJuq6b909IYN+Rh20UNV6K5aGJOZ87ljaPTIBPs4ibIZulxjHsIqSdJoxQQ/0uryuV65gPyKJpOrvb25Jhk2VLJECXXENBZL4L6wJpmrblZIVhbRcUJfNBSGRrghVMBvRvvRabaKIUekevE7FJFmvqc2MWQ1vFO6E2HEwMrW+LEHWPFO4YFzHfbfZfvWTUJciqeqeIuQscxnIDb8OY86/qnSLuF40DguTk+fmb5lyB0ZOToELgPguOrlwirQ3t0gRv9TdHyvDTKdhF/hwYF7SyZGDkfhh1obKQVXz/05UGXvX2uYhtIIfY27u+q+xaQ/vDIqwNcueFwDUjxf8QqGtMBZBAt/9VTNHXG7qMnyzRj+TSO9QqF3KRH+uVP/GTQoMx5R4JSyAOvh4QTdA1hQ88BFb2aks+tapj2SXRGNqf7S6JGpI88MS3B3VbtXVvrXJhmazU0GVNshjsHkzfNX3kgwvbNkoICc+GOIaLfuIwpPhnNHX8pufEaYIV4OkVqi4CnR04eAEbB9kqm0vjcFL8bsHtaW1isidwipl2uHP1mD7ZBj5zif3TiUxTdsbLitdfBPNAT2FYdAhZD7LbQOLKVXOLbvRkNN/7ta/Type8dXeDY8kvRQzwoeUjwOHTSJTyT2JdB2lu641gGQcDpM6d7ZINAoH7kPVc8dcsLmZZIKBS+lhsIOySfaweKMBlX2VQiI0E2+D+RYjDWxwJuoTbcqKp7ULanU4EA6pboa42+sM1SPAip5zB93Wdzs1ZpzTiCTDEpnVu5zgFSASXcmYDK8EJ/6MVURRQlWxdYhOUuz5I41VGUc4LFa5rw8Ge6T721tPV3BrDx7xW9XkEv8jWMhjclorS+lc95ka1TN9oIkJwDSRg3ZSV9uAeU6tGE7ZWLOyO0H4g1qvXRAjbZfE1c5cwRt3fPtH/EeXSLDCT3yD/2UT/Dv54yafPbWP2b7EaahiL44UpyVTOWKLKAaMDbVJSuzCmerDXlA+simnkJ82zDUkcovyCcElzhW3y+KKhOUbpcc5nW4W2VQ5notSIroXjIbK4agyjBkmlCxzVdFbbFkBYNMFXVFYXVx0YkEos4gRBjgEDLmmtmC9evFiPgADcvuKUeCk3TW4cXl1JkiBChJnP8wlYBsw1ntVJIoP4k6l5+UFfcFjqMeuEYBmIDyTBnrRe82mp1l10uuZfH1D/BORuE4MzGJ6jp3TN7KQfMFit8Hi5JcTCXBv/KtIclp1GEe3Mv48OW4oBWA/whEb+O8gjXTT+uYDQ/PK+9my34QaAqGz2b4XYgvYWfPdqqhRDTe+4TZLT6yHcGmV5uFc5O6ntD3L/m7LTLSGTVkWCmgKP2lp7GroSKpdUfwP7BQ2Ou0nZ0phWs7CK0eOtTJCxd5Lxug5HPSd7rKcsVB+aTprlA81coAXuFdZsWOwn+WvxiR78ETwc9GMRuBG+oUJw8OMqOi+Xr0fBH3pwTqDJOZW7ofswhUSY3lZZ3ELITOKpocvt4TsbET1TgzMpTrVB0SVgqLsOv5vsinVChOUEJJYqwPmtXxxItVGuG1AQKpDZE2Vwf1kTrr22Tyv6xFhjsYevggSLYEkcvzA6SEfv9dRk3xncWmmUqaDUH/Xk62Fjdn1mJSTxYWpLIHbn58hwsepCf2lNLVbx2MT1djbvSU5jdzjAcmHdDeqY+3TskpQZCv0nRj9ufv82LhnA/uX/diwetUXskaas0Ko1+qvEdQL9KGY1FcKXYzNchmB193x3qibw6y3MofWCQWSCFIYOd/Dy5PWdsmPzfbKPE/u53GkkE2/lyO+O0vW1JaY6v5xmAqTaFIw8/UH05K2UQo7+TJ4CKykyrb/JtOwMxGWwpEryZ+Di28Tz8+4/0g1dajBGpqBN2RIY8rq+0AjlJlfJ3Kg45Ft39hiIRVsDRAyxSCwll0dmv+ROTVZ3MxJikU3Bs6a650GPKinzeUcNBfvZ864m078oUMfoXELpowHWRWZHNldSHkDXGYGMg9AlEi/8DR/hOrcblh+k2dEQZLUBBndqqRFjSTqYCVCUVZRzR1urKPz8uE6qkwRaXo0/azUz7y3VsXrzzSGQyYirnQ5BXglzwVABj7skalMgqcaovP3n/OOTHUjTkPMWNrI1G0g1/5x4rXcVrBF5XVxnMp0keJKjuyOthPUkaNtne8DiTHoAB3bNUNNHcqOhcNchzDhC5Hh+LOrEwGrRmY7qA7TnpwVLxSP0oAGxeIC/TWfrtui3yyohg8eQoDRSXsWNeWj3MpS2UKXgAMkh2o9Yiyt0+ZopX08n9b0ZbtH1tnZp0laipMsc2mQxSVkBxBfTZYOPNzwvKowsdpr0c5EjfHrip2XUHCAuHGrmVdoiQG0kqBJ98zfYIIb7tc91DzoxJJrpyX7hIjQtPUtWcEDj+Mrvi1/SZ5LGSVb7tp/F2Rrfn12ZcdJLJ5lWOGRtnBtvlW8RZmZ/ONoE8TBshZLswlzlnZdIkqbzD4KtHuqTA29sU98G/6Bmmmo1m1KD+YSRUx6/0CPzM3+rCyNqbw2bN2qX8eDGZlHwZs4xNdNNri0z1XdykblswBLRhj03l1kKt7Of+bHSSNtl45bGTPibCko2HZkX6rGz2qXIAI7vTdjvsr8RCY/MszDOjisREoBkXpgmWpsC8a4MSbOJzp9aSapp4kDGfB2riBl1wOl4u0/YPOVsDA7o+/7Ivbv4es/Ma95EBiLyVGUu/8afPPkTkMI+Czs3W2oug7OdwSLqt+BEK2IVhHYH0yxrxiSGEDgcC0CU07ohtg57e8KxHCZsiLNLDrS9u3aYStJA8Q0P3vtddiGKR2lG4YJyq4sSGxXePlzFZAH15adoWlROvoUc37n7D/ywYLX3SfIG0cDe1wfPrRCwEsm0RbmzR+HgJE095v4EA7/StKEJKXBgDU4PBJuVVzvx0M+B7Te7sMK29J7waEWZjAL5D1KOFIGAjioeCnE3rQ1OUuKZUjVB9EDnT9gAIfmOwieWZ+6MYKcZGThKyWUY34NGFlvbvo6uKWoSW/PcWaB6VjzWQMrCqMx1htwqzq6u8HlwCGnCuDAsNkCdg1rHftzwcAHTQVXjF41455do7AnObYzX6DewCP9dig8y4XJQs4cd3zazLAK6gTjO1EtNozZPRmtokkfIASdipgObsL4tVNjOhuPwWPbyh5EEHEyfeQHWd60lbaVh9qEbTGMqiPNV0W6QUPk4unVzajYjtf9SWir5iAMZOksC8A9+iCnJg7/JfgFmFX3Be3SkuW6/0q5ZRa5V+wuzPdK22d/p/64IV8wEegkDcrbmnmklm0NlddlUv+WTKiQAFrAwPCpBZwV5KXlmSuSRdfkbDwBzv0zqRYW7qnRX5g/Jaxu1WDz+IK2JCCw/KNwo877KQ8ZbZ0r54cjNYHYbHgZLrDwE+oeiWcjy7vg32IrFH9YrRr2tJUqRdW7mEvWfeUr4fzTtEaM63wvu5CKYDGjgqGxSZfzfKIooHi7zffxEQDhb3kpbHMNNr1VtVKMM3FENdUR0xQBLjblu8CO15Jc1OWDCvCMYUySXuvMcXrrtQ8mqpntPyb0QGe93zYNmRssBlbh8Ch4Z+K7QozaWX9WEizjc6TPQknLut6Wgm50qF0k6szQ6OykIzRC+ejHrX1Rbq9W1WRsp4UBQsK+4S1d0yR96JebK1bccMeAN4pJSoSyWOvR5MjxYyI0uUq8lg0UcU33G4W9VD3ywbQ8JpFl/Q2nGSrrPD3I/wPSIKY/qCRac9823JUjOq3v0H5+AYd0iIafzDnJcRZMKlLNP4uXxdh6uLJR90h47dJUafBmvB1XP5omxJbY6MPVoML2wYqon9ziSTdzvCWV98hTpbiqKIYjEH6Wwy/3BvG8AAZyq2nKD1PIyGaigZOnZly+c52xaLlU22V79nvQy/wDq/fP4QJmH3uIy9lkGCpzcbcwI73T7+Qc/HObAb/OokG1NIPkueG0swTTljRvIkMKV2TMBhuud8N2ld0zalx87gO31OhmIg4aNeyz+SjjDY+QN/cxQBY9yuDwQ2X+WPch/tkb8Ys5N+TOGaS0HdndYpTvbN4mpG/BCoSNRGl9z3zjZ2GjwLaOh7qLGIXF1vP63XC+mUKnog74iZQksIDSfLGzLmehoIx9rL9MsN6+eEDsgMW8dQGgYAGup5coDnSfYKGupPt8/8Y9BTapjVVPgcNhk2EfOx3Srph2L+0uCM6J09ByXL6Zf8yaTt5tfjFWw3VorV/Ouc+2q1ry4QvhKAHbBEFSNz5M10HAZs1E0jBvo6ByY2oDBbc6eJLNuFySkALWUFvdjtT21d/+DJhZWC+tmdj9ulHOktlVdp13x+HiT/DxmH+WxA+NJZmSoqVQ+5kGtuqMulnJUsUAB/LZbINvarJ0n4KK5FXwyMCTb3Ka7X80bdnaFi69uJZmKj4zYJwH7cDQI1Z8w6PtQJZwHOZjN8bwMsHP+YsQnWjPvoIOkI8HVePugeBV+5WdYF7PS/puiG52md+8Ino4US3DgttaFkCleOjo+d/JSKe+SSWrd0BiQwOJy3ZOwrokAE0/ytqCNL/K3IS7b2okBle7rlbDfvERdXhT3bEOmrQhkA0J/2qZU8bpgPMExLVMEQ76bu4w962wFRv98tnG+khtVPNeung5PKb/VcfNg1Fw+z/eNZG/jz99e3yWgU2zk1zWO8AAV7rQgatfSqtI6s3iqA2qjpPfWPp/lmgrEcxwDJKAheEP0yhafefOv7+UsAdu+CRKIh5sdFCEVAfNAUOZJhavP33Bitloy+yof4mYUoFz7sQyxMD4RfTBv6rWH8cedsq6kA0YI6uzfRBW3M/ODpk1ZfXh8muxmW+pK+rXhOrqSyIEsbRxnhuyGUetpNj24+Ae05JbZApp0MH1eazLetr7ffCfUrntiNEhUfzj5rx+JvsgYe49IOoK41xWE9TtePyP+AcCL4+N7ALKYNNqykBMvlHLbTHGrGzcOO3XS3UbxcFnrg808kwORzLtvXTdd9tJkyGTVnTozyS/mYxrVhbNtC3Vgk9Omhr1Tr6lBn0Y5UvV002H8IOwnstgToIvS2PinrQPk1FMGyzevr1EGZmClE2zkm6dEdhAmz5P2GL+bb56t/nTEEGTlf2XYE9hWVIh2SN9Ne0aVko/KGaSQPXXdpJVSrRfFWBjXiJnmJsiJRpJTO46Dd+ZrSys8wZNRO0yXEQQjLIeXtMjtBokbmDV6COPR7/Ip49MCKECGaEAFVM9j899HPc36VU9edD9N+u+IZxlHKxTc3E92iju0KRMc7zEZpOKQ+K4zyjGCdx5QGcUu57oHtepzgdJ6ifuSL+QTlDBYBuGQ5WDbK1SbpfPHfQ5wuDd5Zki1I9UqbiJ/7I+b81PU7AEHsdCELzFZHvqzzP1U46k8Y124QMSuYNn8+hvHtjkT5qFtgZgoDRDbxtUPpjQ7zMGEc5jBWMQGhTtAXSgl6p3koBcUQQzW4ATnUwS5LsndiU837CHAa2SeuJTNrZwYI348wlj351sA+VzYCWDtkRjWna6ruNc3/ek91rfMmKIlYsflo4hhBV+VcLnOpRH32/u90iAs7T9deZgUCsTMoL+hsxIr9P1YF98vXjsU5PDH9WMsNa2ngIxE5jBV0isVkk8xpD+klDvtl7KMGazYH0yza2hUbc0AtMZsdcgXw2JQ43Hubs7f/SVxNkn93DduXwENKEWufOgUGT6YQcqZj0ZyupJtNJAbmZqbMQUs3F1lrZzbOHC1n+n8U9eIxHHUb9m/2F8qTbBvGjUs9Jb21AFk1VkRRjPuOibap8aG2r3fIOhR0pRYECi+T2ya75C1oQEt8aAa73x0JTJ6hmh/Rlgo8wZ1h2X+lS1H7Y4duS8y0CBz4x6kP60M6I/BQgVzhsIiqHGrWQcgOJ9VqcGLZhhv3BUjJtEY/UBSBYdiGJt4o5QI0PF6h5seMpuL4zfWhAvxIVPdCWuJZVKxPqj86qP5xlV5wIfOXjZeQ1Zwr+up2tGtAtwK2L49aFzrUhuKLK62GS1U/zgyBYHu0a+2A0cS5ivEhshm/HdxukxNkRfrVqlsDLGwkfConxd8a1nnF/jLzPQ42N8Apol6Xpo5NfZYXrDmqWYXVErc5GhCnNY1d1OmVnaevtTtNO8QdkMCpfihEK8VBEvxg1Srou7CMjDN89HY/8Zmutw4GuKBZ5eoN5PI8apTVDhFw8AgVV/1G8D+vSHMgOSZvbK1KUDUt4DouqvXYTv1iUAtoD3zuxZlRT+v+p539aQQr3FzCfpvllodH8K8qsITMFq84+Csz2oKVxW9RQ4S/brYuu8U38LZfm6QfvbxmjBAr/tRYr7igJtHw065vRESj+iJG04UvnrOiPLoEy8H2qOkqYbe7BwaBfRkbLIcIwmHSaCzC+HVzKWlTMQx6FpATVTpDV08ixAQDs98co/qPunki5q9F+0EGlRg67f5jml4Ao3FWm9rtduWiBBEfxeaev5R3kiyeq5chOTgo0sjQUQUCg4bXp0+T6zLiFb87YmnZClDzYDnsttY92YK9JPh3PebtXFexpqBS4TjlmapXcMLJvQceujDdgly+8TmVJDyIiAvkSlC+0YFNw8A8Nm4BGCNZFbMcIs7nqdYNadjU3pPqAwPpq0ey5eOFjfWo4mKuTxKNpjV85JTrQxFFY3Q4NjasT7i7MUPg+pJA+ytcvU4+sQfLvkpBHMWBDUr2bhbH4vGd3G8NTiqHnVimxhP7Nt97sowoFe5wD1zZpxRg/TISaa93Jx/IcG0AzMbQwPrgXNcjLYB3X5IPmeI2Rwx6NLNlCq4jOd0oWC7kRBF2rl3wP0bYbb4mBDBBZfxwSW8CijWt+LMVhwfmxL53dWDeIBR0xX+40uW0/zbTDMmR/pR2DJUOjyCYr2lQRh+NpkVuLjTxOjCYs1NS8aRXLcoTHHojJAOIwsugGPTq7iPJuFrNsqi2LBNbZ0l9FiFwNFfNYaCq6buZqN4matYw/ksgOn4IlEO/Hqd1gSCHdICuXaudY2cuwKQZmWR8F5SNMb4DbYlZvI2XTxdf2pj3M3Uqd6xOl1TfSO7GBL/OnVJK91r1ZsHU6SKmL2U3HYuAnOSO95GOq11hYuXcjMF6T5zGPtRcg/wrNryrKX1BQNB1bOUaG1srX+LxhqMwImLD/T44OJFDJz619BeoxQkXGx7qvOxBQbOpEyXGW5VcxkaWiTUeb6kK5O2e6AxXVpKAh0nHEtQ19O4vsGFeIGGJov+Fyeub0TXGKJf1d3XkvYoY/767HJ3RfPfvTH0c4oALNKNRwQ+cZ+86L+xJm+ssbIkbpX4vHVeNO+qIVnov+pbIGaluvzfgvHl03e1GlyaPdDo36Mv09GsAIZq5svebXiDyskrB4YMtpXWOIeFDE9LDaPbHGol6EoYPIEPyFcLL0Kvc3rJ7dHinpycZUjG81GFwsIGk8R1Orzhkw6tFMC9zHWkaQ9ToHOFZWZXRhed0OAH6LiTotpAXAy0+T8hp6qJ2wMhHnSVvGh/Qj5z4fzmAXVLO0WrESqiDH5Df+ObjHbcffjn8i4fK1R42Mo6gfS1+4Tz4VpJRAma5YuaCEGOLnPWe9XcxYwPGj3Vanfr+/oRS+c+pbAGxPK+UcfQlAAX1KNo3I4wAQ9DyTX6YGnZhMELuBD6ntVY5gFv2MvRT6DmN0QYpEAOzv/B+/BxbHvsIf+kgv8vyYMRWtsU+B14/GM5E2Kdx+WxGIFY9S6x9fKaWRIz7+DBzAYNX4vMvRKuNyITTk/7ephQmp9d42lydsZWyoviULXpDJIFol7fi1Zzqr0tVx3baFxbgWwIiiDxdgWpT3qgf7Jfm9Hdr6cmP9TbxXEWBmvkYFkj1jZuLNnT8W977QbwNx9tVsnf1JVEFvLc9/wfR/0mH7YUjLJy52bTspy808p5JGeC2j2nsgRXTvQYU6cmCy9UiqRPplgJKRheNHiXOhxVRCzVmEUe/DBFBdEtgO1lxScDrLM8Gudm8kqqNnqcYrrvuFCG4KzAmb/B8aFzaI29Mw67WTdQ1ZzX/OPLiqTxzY7X6vERwoeZvYvFIEDXv5DTF13FK7Tc8PD/V2I1U6oXjukzRGoGAeSCjcy6dJiwGfDJniFB1NGmVZtF+baFRVWN/DN30KfMuOHWwpfMlhhTMkk8GQ9+sz/t12+FqtfoLHOqFJ2TJjMRB9mpmXnAW7C3wXwzSaeE5RL7YYdBWYn1Xgcrqm7l2VVBTdA8lqhch5MjJdrkk+cvvKy9BFB5p20eJ5EX5p3fg7BUz/P4Iea+RT6bzxGOmtXctSlmV0gK72nJyIA1AuLuuKZzO6WC+pXuPMQ4LK5mdEl2GI5yMbTReL+po5rBaFPuBsqRGxsdW1Q4uiqjCCCGSkBwcQKNMDaOqlB0Kat15Xnow2UOIAymdggG1/GKKcOj0/M/GlwXGX3kXrZFc3S+XV5g4gzhaXFtIHtPfLZxQug3JkebcvERa3SjFxLQBVvTity+7yMC1oadTPYmyzpn/gZPn4I4CKqnMhvStXyJJ6TV173qAdcrh848DU89KVeYdiinwnPfGumYr6rXEvCFkAhtrc2NHKaK5LgOH2KygSYHcXhvXCWESrFpQcKByPshCsKYZG8jWqGTHnRew/Ldr4LpNM3vG2QyvB5frrjhQ2vxHWcMeywTVwJ/pzRATYxak9y+5kjhfHeGDyEFGQ9J5QB4UXRHi0vIrc8Uvj1+xP/zYosRtXdx6aQsdYtuS33YNlMvvbUZ4pnxiFDHPX9ZK6sAJ1Iow8W/qtHZeCzulrMsAF11P1fuG19zA4BJC9y7uqQp+gZoDoo5rXo4ZirCL3NuiGKPg7CT4TumahP7CRr/GRuhHMzZXZkOctKJVSuqWtrYymf/ftzr3cgZtXk92Q0U8x71plqwQOdNjYu3iaLNG2YndNXjEmUci6LypteY7nnrtVfz07MkZDPGkI+f3N6Ap6ZAlPFW7SrLAOlBty0JepDxlxZO6ne2Ft+W34Xd4RFSgvtiHS8UZolw+q81gS8kcw9e0RQWzK7B8go7NyendiILJUMajEayQnmKj7zxx2CPCtxaYWAXiXwi3rwoVEGiJPi2Wl4DD4P0USItnrNFcVLU/7iEPra4wRo3e953SxZosbA0iWG/YUfy2zBLJHIsmF+XFaDTNlrh5vwIAHUqY19nkKmaoDMrapKQIW4BUj/c318H4Z2NAq2z6y7nHHNSCJCGew+IdYIp1S+t2Hr1cAKiFyeszrO+9LZiKpdIdWgNO+eqm2ybpGvXxjLKndCl9jflQvXUnJeEvbNlQcociA7z3BKzgVlBriIs8ASI+2kBwXg4Y3bXL2lKvyTUrCwaB5H2LIQa//sqXs2OPtGh2cpQrnzTs6YkGvyfJGo8SsMC0Vp56PSkd2jC9QK35D2q3FvYRnjAd5YCvtE23IPkoOcpvALP1FGs88hlXNjoobbBX3PDn9S1iDSxbiabAyoeP+h1fn20w0nGeT1OnYdpxeE8z7QgdFCEjnHWcaBcPxxgBIvXxolV+BuQaskQLNjewP75BLY/PsYrnQjYmI7huamCbqHNavbT5C4Ri6BqH5xG2FiEr6YUfOHzCpSynPMm96z6wCOK1T6kTWZjL2TwBSM21FPyT2gMM3sdtgVJgv75rdBKHvVXSYdU0MTzC758Ai7oh9uRUskHWmDDlB8Rc0LFiotdeRHnpBBqK5cwaRlwmdlV8webwwmw4mWp2gzKuwIsUnwpngFLe4MI93bKOgiBM+d7BNVqQ76FluyOT9QpY8L6Vvlznj7aRMuWn8eEHKwA/kyxzC/YFve5BTm9ayllbsQb1JPGZUxHbhsI6Bxp6gluMqRNLpu607PNbIPJmN/QRtPt74pbgI2wMvh6Cjwy2KdcleO81QkeyzYV78gFtqE4lV5xzIcBXgMFZlhKnJR8J5d+uyurXG8HfWAX/aExaehICMOc3mT04sc9CzTx4X+ZSMfQQY93TOlRGPbWOmVHTiLtpPlFXOEkxXeaK7W0OQ9vyG/bCSiTiamP+YZ0jNzkKMJvMbvV14ZLrbESpNneW8yqNBGhjzNiTAPNNIcH3R8daV1mBLYoMqhYI0OFeAtjhCGGChWsalBea01/loms59tOG2/CEPDgbu3/s4bNDXh6K0hbMSLiy6pQ7nB+skm1lxaQimdH43GamjXuWkUQB1Ho6yLvLoWVq4KQjc+Dl91GxB+LQXw7YykKNH749YvwUnVNfBItpvX+7qap71XLDXwemd2hHBmUAxzcGKshb67tZUKPV1buxH+u6VOkgrm7X4XTDHgExI2hFuPaYobcIdHbHtMzwTE3B+m6Y+CPleC6Xq5ckouH2D80LzWrQvz/qfHTDjiavY1L938ITyHUcmT7RGQ0XVhvKEvECiOhz9zVrhxGCQZ9Ad4/DjMKOtOLb+2PaEtERmI7ySGbNtPPliz6e16MpWhrwIzU1M5ZWh0iJ+JnKawfhjpcmjs3Nof2euPjC0O/RmuDF6C92PZHQdrjG6DswNgUu5taZ5DA0dA4yHux/Q97mWQ+cTaHuSmCAUoTXNC9WInGZ/kWz5i1MtSM6jz9BiPbvql/85bwJOam5XlO1mMOLx6IXpoND/GGq60hPYqXA+X6RMCjfKGw1LFcHR85pwkPgZsX8VIgOVOKKQ2wyqnu73PAuBAYoGPwcZW6aiOU1mtaiPQW4NKV1RppZ2oS3FfOR+O3nOVqt1nrobBHCzIFy+FduyRZapUbWpND8d9+WA0nea2+ZSeaBhbmnD/gcivZKinWl2xakO2vEURoH54rTJOgLouPqJ5VO0yJUb7SfNGGS6Gl6GNeMiPXHeAWHMIY4nYRhStQjrVoLLGPA4cyCECbPPbDqU9bKWVek030XJs6l8BsUY19I8FtlX2TRkMIxLPR6r0JY2o8RD63JfFqeOAWGGfEMdKqIyft/uVUPF0U5haZl7bYMWtw1+HMTsHE5x7+cm+UA7sX9yHfpPcgB0Stptb/sNG3F2TA7WKuOdKfkk9LUokbC74LA+DFLO5wGaHU9GZw7NMasS+6LWl3VaSVdnOXr3E5gBAQuDmOz5EKyTTGIRwOF8cQto2P9iKYkvyti7KFcyUHczHJU0QeCM1rdV02MBDrIcAe40un/ze0raz4G26xp2RgUGMH2+7A2VNtSRX8IovWe8ozjgpEDGlgHu4SeChqV6JeYLSEY42TKMXjAdfx/gbhOVEbtkZFvJbqIH07X+6PG1iuV0CpT0uoyMqQBoDdgy0rrNYEHGL86vELjQJYX4KBeqIzd/lFFju3syRnLARd3WDkuZOoqOA75L3XLlscW0zG8NA+Gn858gLaUl33OYzR8Vu4Q08kAhwb9zYFe6VgYNAINj4+Ctqht97C2dLucJBtMCii/GtjHl9K+lGSjuiymfjMrVjsFVpRaZYYfN1XtDYxapPSX8yxbH6aGlcj56pwcALYn+VFH+y87Amx1C49yhZI/24HL2cYtNsHnFdjedZlmim+58DhGM7oPJUTZHNxwvE3WIiCRvxKl8ZztP+G4VYGq2afj6tAna3uVIJ9UkyLhJBvlQzoy+t+9TUto0c9VNEnhCV1k0VfaWLbSj8Q5rhWVRDAAJF4EFl0X8twYaRUXRxlgvxUAV0S57ux3eUhAGij0DTAHYhn9HGxQZNkU947bM82MLMsBDNHZRPSloYXvDvLnJ6zxHlHJ1ub+fcb135cRZ7xx1XlxW8HDXGUfxlzt/s9IhdRtfJcgZ/KHlZzZkqp544VAFlcaeK8KliJyd4mc+/+iQntEAtoWlR2brRUx7VWwGd37oorEw3ac0mRw5UWJ+MIE3QAtTUjKlfuAILooTDOyu+hrUzP4C7Lu0Q/MnOCNzIgfqoaBwD6HZuAnYXHcpvTgRWcp17spEDA2zby8oQ2k6PqTlVU1ylsRdKkSHb5GW8AAft+aE2agSNcftqyxD2mgnGdhWUzoqD+/Jc6OiC3P9btzhgOY6scVFvssaxOjr/+9aHp/HJpowlqHK0XBs0/i4SLhFYLU+C8/bG+4/+zZGlm+IKOesASW65nuQiafr3WcMyvjqtmX+UyT/17Xio/l/EK80aYezn18G7mg8SywcaTrRDCAjiMoehJCMdqF0f3pokvGST1Sd1NYGXcVsmUrb5g6DT152u0Z9qtUpAE3FX7AKF3Ed3XVhUyWDA/6Bg8ay/d/GhFMxWlP1yyWe35hYg6FL+zrlKflTVv5Q3AaqaLBL0WJoeiFzsou5CsWPLy4sCINDpCKX/qhrVhcXlXMPP/vPPA6m7s5fxtaY1T29lD2FHnRxyvwRHGWXNZ0wKoStA9JefpW+SyuCey5/7sGvydP0mK8r9mn1srCDfN82QtbB6kyf5taMV0A+sywdsiAgv1mPDM/Uo+HC4h7nLQMmwHC1a7pvzrnkcvLztrORAHBpp5EdTpf4wHai/7SOzDqZsiaOgFchHkFuUJFAyv6nozj2IL9B2VQyXUSuBfaRIp2pPbV7NEoGOrGbFln2y7zPUvuEGVDg+ZjPlJvIt4UXcfgU/NSsmf32E9LLCnDyNwBpePUT8Rd+j/O2/lzK7ojDZ2m6dm7tOEipnsjU1GARXUaxCaV/LldjMqdTDXQ3mBNcM8vuRpsEN51wcuaLBLkdp0hesH4k1j/1QBrfCWEBIoCJlSNi4Gyu2vnmWE1lDg9sMus/oeU3SzIdIbAWASZud6TzJURrjxvbdM7vrLqAtmckQ3aslfbQKQr1a6/9s77YKvX28kvRAUKmHzJ70POy0o8Tn/uVJ6XMa1LAzJ4pWRJLZjo77IaWU2aklOyTfDpBGlGJZu4huBAFf+/SfHw2jJOwB/Ck44TPZrrvb41vqQ91vWyERkdUWorWQpzveA/hDusnNcW8xnEIsek8C6fPurM4cCghv7ll2kkSnCOIPJX85LB86RJgYTCCqS6rAK3ZwiHfZureI3k8ykjVCYhXtDON5CdIQlR2S3dVx9IsUmHR9n/zDvlvxJrB67OvLn4UAP6PTL230Yfk4IRwY6Rh0piwlzIPRZgtlD9JuYt/ilRrF+i9WTpYLDgQCMGNEziI2S1P+bIgYtm4oWF3INcay/Hmfk/2P0G2fv748yBGi4V24SyRR89aygrTVSinWAwLkCIcZKfZxQTpiGtKQAx0q8CzcEA9L9UQ2NaQ9Ht48Zl7S7IxHqVf5r/FLMUbp48bWJil7UV/7NvhrW3hS7+/M+AMbm99saPz85478CGle9tcH8J+zCd6g9Y+C7+eUTrxn/uhyDtAHpwIsrZqutUqGK/WjRl/hgx0vHE6aKsQnLxKkWgNs0/UPuoZ4lxKrt/DtiIHIW0YhUtzwS1Abw2zc7MduYW0Fg50R/hB135nXI4UBg2c5yrrb+9NOWnUw6LuRjP5Ayh+EkX68z+9BDGzOmRRIX+dB+mEjHqFuvL1mI6hJp1A/Ai5J9L0/27FWfpVlR5rPLjiyzd7NVyo9tlFYRQXVKA4whm6FA2TsciKZiWBcodVCXvb4Rz4WEPh39ajnoVNaBRyPr3Z1+POxoADHXbPGbI73aJgdR0vRuWrR9wrKotHNxO/fCuu3McnVGYoiJ96SujsZKCZqPqhi7Lm4U5o9jl0Bt35dTBNvp5rO5/KYBZviAW8DjGf3pUYYuzbxW+APlDlvr7jbcZPPpYAE4k0NLR4aIB7qpbt8c87oGW3CBWjEUnKYBX1imKw7ksJ/vpwHsfmcttl10hlJTW/ANuJP5+PgkQYCo07moZPzP2TkhchkP6lI8pvihPp9yJaYbPIojT42IMfVpUATsEg02cBTug/cRVhoR5xwdRpy77oMCgzzQFxrWQSRuvy0Zp7Zoek6Bc/cXBBEjAc80cz5e8sVw8S00iHf4EkHabdu95/mOJkWxKhkq7Sec0NYUG3QnNNPo3wcp7ziOG/Cb8cRaze/WGUriWHWMwAxoWtGFYftid7DGJGeaQl1/uaidUbCwmHf/9Y1aEnpodcd/gZlakzsT4YEW8YO03fC3tZNa+Q4mHKVGbnFafgXepcT4bslRzjgYpX0NCyQCVsfojXXYC5uSYdKPXwiW7wBWkuLmv4KrfSNkFSnsvHd8E/1goTLT+Pn/hQuBBhGUx277BsgL1YWClustgN4+K8yCaBjji/Jn9yvneNybTEDvlVR+AWtewwv3GoO3dM5Pj9MP4dk4/jJwEarJvTkhPF/W1fsAKvqSZH1ls+0OG7OuTgBdWUHOgHt72wfUmrfw4Jfp4Ztx1JeC9/yc0ZFRl3Tj4PpViXm0OYncCXKcAdcmFqf2ZdzrtqeuPmTpTDlXzhwAVpLAEFAtKFsVVPMjVDwcAAVKMn2wLgJYkCcA82efBUKZcsNU4gleFkfyezh5m+6o1SNlviuys8fYK418dmV7GsN6vMq0wZAVL/JmVLuZmfbFRblwmzNfRJCBPx5JMXnEScvDyhOd2uwiJlZLYbQWFkPWVEF+UhEWobCFNNXxesB3wq0f2xB8xBueSY93QWEX+MkXXZnlNuWpdBc1nrhlfUQAAAA=';

  /* ---------------- small helpers ---------------- */
  var TAU = Math.PI * 2;
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function wrap(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------------- sprites ---------------- */
  var PAD = 14;                    // room for blur around the 256 x 185 butterfly
  var SP = null;                   // { w, h, axis, colors: { pink: {...}, ... }, shadow }

  // box blur on premultiplied RGBA, 3 passes ~ gaussian
  function blurRGBA(src, w, h, r) {
    var n = w * h, a = new Float32Array(n * 4), b = new Float32Array(n * 4), i, k;
    for (i = 0; i < n; i++) {
      var al = src[i * 4 + 3] / 255;
      a[i * 4] = src[i * 4] * al; a[i * 4 + 1] = src[i * 4 + 1] * al; a[i * 4 + 2] = src[i * 4 + 2] * al; a[i * 4 + 3] = src[i * 4 + 3];
    }
    function pass(inp, out, horiz) {
      var len = horiz ? w : h, lines = horiz ? h : w, win = 2 * r + 1;
      for (var l = 0; l < lines; l++) {
        for (var c = 0; c < 4; c++) {
          var acc = 0, x;
          for (x = -r; x <= r; x++) { var xi = clamp(x, 0, len - 1); acc += inp[(horiz ? l * w + xi : xi * w + l) * 4 + c]; }
          for (x = 0; x < len; x++) {
            out[(horiz ? l * w + x : x * w + l) * 4 + c] = acc / win;
            var xo = clamp(x - r, 0, len - 1), xn = clamp(x + r + 1, 0, len - 1);
            acc += inp[(horiz ? l * w + xn : xn * w + l) * 4 + c] - inp[(horiz ? l * w + xo : xo * w + l) * 4 + c];
          }
        }
      }
    }
    for (k = 0; k < 3; k++) { pass(a, b, true); pass(b, a, false); }
    var out = new Uint8ClampedArray(n * 4);
    for (i = 0; i < n; i++) {
      var A = a[i * 4 + 3], f = A > 0.5 ? 255 / A : 0;
      out[i * 4] = a[i * 4] * f; out[i * 4 + 1] = a[i * 4 + 1] * f; out[i * 4 + 2] = a[i * 4 + 2] * f; out[i * 4 + 3] = A;
    }
    return out;
  }
  var HAS_FILTER = (function () { try { var t = makeCanvas(1, 1).getContext('2d'); t.filter = 'blur(2px)'; return t.filter === 'blur(2px)'; } catch (e) { return false; } })();
  function blurred(canvas, px, r) {
    var w = canvas.width, h = canvas.height;
    if (HAS_FILTER) { var c = makeCanvas(w, h), x = c.getContext('2d'); x.filter = 'blur(' + r + 'px)'; x.drawImage(canvas, 0, 0); return c; }
    return toCanvas(blurRGBA(px, w, h, Math.max(1, Math.round(r * 0.9))), w, h);
  }
  // pre-shrunk copies (1, 1/2, 1/4) so small butterflies stay crisp without costly resampling each frame
  function mips(c) {
    var out = [{ c: c, k: 1 }], cur = c, k = 1;
    for (var i = 0; i < 2; i++) {
      k /= 2;
      var n = makeCanvas(Math.max(1, Math.round(c.width * k)), Math.max(1, Math.round(c.height * k))), x = n.getContext('2d');
      x.imageSmoothingEnabled = true; if ('imageSmoothingQuality' in x) x.imageSmoothingQuality = 'high';
      x.drawImage(cur, 0, 0, n.width, n.height);
      out.push({ c: n, k: n.width / c.width }); cur = n;
    }
    return out;
  }
  function pick(m, need) { for (var i = m.length - 1; i >= 0; i--) if (m[i].k >= need) return m[i]; return m[0]; }
  var SHADES = [0, 0.25, 0.5];
  function getPx(c) { return c.getContext('2d').getImageData(0, 0, c.width, c.height).data; }
  function mix(a, b, t, alphaFrom) {
    var o = new Uint8ClampedArray(a.length);
    for (var i = 0; i < a.length; i += 4) {
      o[i] = a[i] + (b[i] - a[i]) * t; o[i + 1] = a[i + 1] + (b[i + 1] - a[i + 1]) * t; o[i + 2] = a[i + 2] + (b[i + 2] - a[i + 2]) * t; o[i + 3] = alphaFrom[i + 3];
    }
    return o;
  }
  function toCanvas(px, w, h) {
    var c = makeCanvas(w, h), x = c.getContext('2d'), id = x.createImageData(w, h);
    id.data.set(px); x.putImageData(id, 0, 0); return c;
  }
  // recolour the pink gem into another gem colour, keeping every facet's light and dark
  var RAMPS = {
    blue: [[0, '#3f74b3'], [0.35, '#7fb6e6'], [0.68, '#c4e4fb'], [0.9, '#eef9ff'], [1, '#ffffff']],
    white: [[0, '#a7aebd'], [0.35, '#d6dce6'], [0.68, '#f0f3f8'], [0.9, '#fbfcfe'], [1, '#ffffff']]
  };
  function ramp(stops, t) {
    for (var i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], u = (t - a[0]) / (b[0] - a[0]), ca = hex(a[1]), cb = hex(b[1]);
        return [lerp(ca[0], cb[0], u), lerp(ca[1], cb[1], u), lerp(ca[2], cb[2], u)];
      }
    }
    return hex(stops[stops.length - 1][1]);
  }
  function buildSprites(img, done) {
    var w = img.naturalWidth + PAD * 2, h = img.naturalHeight + PAD * 2;
    var base = makeCanvas(w, h), bx = base.getContext('2d');
    bx.drawImage(img, PAD, PAD);
    var src = bx.getImageData(0, 0, w, h).data, n = w * h, i;
    // luminance range of the gem (for recolouring)
    var lums = [];
    for (i = 0; i < n; i++) if (src[i * 4 + 3] > 200) lums.push(0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2]);
    lums.sort(function (a, b) { return a - b; });
    var lo = lums[Math.floor(lums.length * 0.03)], hi = lums[Math.floor(lums.length * 0.995)];
    var out = { w: w, h: h, axis: w / 2, colors: {} };
    var jobs = CFG.colors.map(function (name) { return function () {
      var px = new Uint8ClampedArray(src);
      if (RAMPS[name]) {
        for (i = 0; i < n; i++) {
          if (!px[i * 4 + 3]) continue;
          var L = 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
          var c = ramp(RAMPS[name], clamp((L - lo) / (hi - lo), 0, 1));
          px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2];
        }
      }
      var dark = new Uint8ClampedArray(px);
      for (i = 0; i < n; i++) { dark[i * 4] *= 0.5; dark[i * 4 + 1] *= 0.5; dark[i * 4 + 2] *= 0.56; }
      var sharp = toCanvas(px, w, h);
      // body: the centre column only, fading out sideways, so it never squashes when the wings fold
      var bw = Math.round(w * 0.11), body = makeCanvas(bw, h), bc = body.getContext('2d');
      bc.drawImage(sharp, (w - bw) / 2, 0, bw, h, 0, 0, bw, h);
      var g = bc.createLinearGradient(0, 0, bw, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      bc.globalCompositeOperation = 'destination-in'; bc.fillStyle = g; bc.fillRect(0, 0, bw, h);
      // wings turned up catch less light: 3 ready-made shades (no extra drawing per frame)
      // nearest butterflies get a slightly out-of-focus copy (depth of field)
      var softS = getPx(blurred(sharp, px, 3)), softD = getPx(blurred(toCanvas(dark, w, h), dark, 3));
      out.colors[name] = {
        sharp: SHADES.map(function (a) { return mips(toCanvas(mix(px, dark, a, px), w, h)); }),
        soft: SHADES.map(function (a) { return mips(toCanvas(mix(softS, softD, a, softS), w, h)); }),
        body: mips(body), bodyW: bw
      };
    }; });
    // shadow on the page: dark, soft
    jobs.push(function () {
      var sh = new Uint8ClampedArray(n * 4);
      for (i = 0; i < n; i++) { sh[i * 4] = 70; sh[i * 4 + 1] = 40; sh[i * 4 + 2] = 55; sh[i * 4 + 3] = src[i * 4 + 3]; }
      out.shadow = mips(blurred(toCanvas(sh, w, h), sh, 6));
    });
    (function next() {
      if (!jobs.length) return done(out);
      try { jobs.shift()(); } catch (e) { return; }
      setTimeout(next, 0);
    })();
  }

  /* ---------------- stage ---------------- */
  var cv = null, ctx = null, VW = 0, VH = 0, DPR = 1, VMIN = 0, maxDpr = 2, slow = 0, seen = 0;
  function mount() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.setAttribute('data-butterflies', '');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;margin:0;padding:0;border:0;' +
      'pointer-events:none;user-select:none;-webkit-user-select:none;z-index:' + CFG.z + ';contain:strict;background:transparent';
    (document.body || document.documentElement).appendChild(cv);
    ctx = cv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  }
  function resize() {
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width || window.innerWidth)), h = Math.max(1, Math.round(r.height || window.innerHeight));
    var dpr = Math.min(window.devicePixelRatio || 1, 2, maxDpr);
    var changed = w !== VW || h !== VH;
    VW = w; VH = h; DPR = dpr; VMIN = Math.min(w, h);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); fullClear = true;
    if (changed) for (var i = 0; i < flock.length; i++) if (flock[i].state !== 'exit') pickTarget(flock[i]);
  }

  /* ---------------- butterflies ---------------- */
  var flock = [], clock = 0, raf = 0, last = 0, releaseAt = Infinity, released = false;

  function baseSize() { return clamp(VMIN * 0.105, 50, 112); }
  function sizeOf(b) { return baseSize() * lerp(0.3, 1.25, b.z); }
  function speedOf(b) { return VMIN * lerp(0.1, 0.3, b.z); }

  function pickTarget(b) {
    var s = sizeOf(b), m = Math.min(VW, VH) * 0.06 + s * 0.6;
    b.tx = rand(m, Math.max(m + 1, VW - m)); b.ty = rand(m, Math.max(m + 1, VH - m));
    b.retarget = rand(2.2, 4.6);
  }

  function spawn(sides, delay, layer, color) {
    var z = layer === 'near' ? rand(0.84, 0.98) : layer === 'mid' ? rand(0.4, 0.68) : rand(0.06, 0.3);
    var b = {
      layer: layer, color: color, z0: z, z: z,
      zf: rand(0.05, 0.12), zp: rand(0, TAU), za: layer === 'near' ? 0.03 : 0.07,
      phase: rand(0, TAU), hz: rand(3.6, 5.6), glide: 0, glideT: rand(1.5, 4),
      n1: rand(0.7, 1.3), f1: rand(0.12, 0.3), p1: rand(0, TAU),
      n2: rand(0.4, 0.8), f2: rand(0.35, 0.7), p2: rand(0, TAU),
      start: clock + delay, state: 'wait', turn: 0, alpha: layer === 'far' ? 0.78 : 1,
      exitAt: Infinity, speedK: 1
    };
    var s = sizeOf(b), side = sides[(Math.random() * sides.length) | 0], o = s * 0.9;
    if (side === 0) { b.x = -o; b.y = rand(0.1, 0.9) * VH; }            // left
    else if (side === 1) { b.x = VW + o; b.y = rand(0.1, 0.9) * VH; }   // right
    else if (side === 2) { b.x = rand(0.1, 0.9) * VW; b.y = -o; }       // top
    else { b.x = rand(0.1, 0.9) * VW; b.y = VH + o; }                   // bottom
    pickTarget(b);
    // aim into the screen, toward a point in the middle area
    b.tx = rand(0.2, 0.8) * VW; b.ty = rand(0.2, 0.8) * VH;
    b.h = Math.atan2(b.ty - b.y, b.tx - b.x) + rand(-0.35, 0.35);
    flock.push(b);
    return b;
  }

  function play() {
    if (!SP) { pending = true; return; }
    mount();
    // whatever is still on screen leaves; ones that have not flown in yet are dropped
    flock = flock.filter(function (b) { return b.state !== 'wait'; });
    flock.forEach(function (b) { if (b.state !== 'exit') { b.state = 'exit'; b.exitAt = clock; exitTarget(b); } });
    var area = Math.sqrt(VW * VH);
    var count = CFG.count || Math.round(10 + 14 * clamp((area - 560) / 880, 0, 1));
    var stay = CFG.stay >= 0 ? CFG.stay : (VMIN < 600 ? 2 : 3);
    stay = Math.min(stay, count);
    // layers: 20% near, 45% middle, 35% far
    var layers = [], i;
    for (i = 0; i < count; i++) layers.push(i < Math.round(count * 0.2) ? 'near' : i < Math.round(count * 0.65) ? 'mid' : 'far');
    // colours by share
    var colors = [], total = 0;
    CFG.colors.forEach(function (c) { total += COLOR_SHARE[c]; });
    CFG.colors.forEach(function (c, k) {
      var m = k === CFG.colors.length - 1 ? count - colors.length : Math.round(count * COLOR_SHARE[c] / total);
      for (var j = 0; j < m && colors.length < count; j++) colors.push(c);
    });
    shuffle(colors); shuffle(layers);
    // the swarm comes in from two neighbouring sides
    var pairs = [[0, 3], [1, 2], [0, 2], [1, 3]], sides = pairs[(Math.random() * 4) | 0];
    var born = [];
    for (i = 0; i < count; i++) born.push(spawn(sides, rand(0, 1.4) + (layers[i] === 'far' ? 0.15 : 0), layers[i], colors[i]));
    // the ones that stay: middle depth, different colours where possible
    var mids = born.filter(function (b) { return b.layer === 'mid'; }), picked = [], used = {};
    mids.forEach(function (b) { if (picked.length < stay && !used[b.color]) { picked.push(b); used[b.color] = 1; } });
    born.forEach(function (b) { if (picked.length < stay && picked.indexOf(b) < 0 && b.layer !== 'near') picked.push(b); });
    picked.forEach(function (b) { b.stays = true; });
    released = false;
    releaseAt = clock + CFG.duration;
    start();
  }

  function release() {
    if (released) return;
    released = true;
    var leaving = flock.filter(function (b) { return !b.stays && b.state !== 'exit'; });
    shuffle(leaving).forEach(function (b, k) { b.exitAt = clock + (k / Math.max(1, leaving.length)) * 1.8 + rand(0, 0.25); });
  }

  function exitTarget(b) {
    // leave through the nearest side of the screen, leaning toward where it is already heading
    var outward = Math.atan2(b.y - VH / 2, b.x - VW / 2);
    var a = outward + wrap(b.h - outward) * 0.3 + rand(-0.35, 0.35), far = Math.max(VW, VH) * 1.2;
    b.tx = VW / 2 + Math.cos(a) * far; b.ty = VH / 2 + Math.sin(a) * far;
    b.retarget = Infinity;
  }

  function stop() {
    flock.length = 0; fullClear = true;
    if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function step(b, dt) {
    if (b.state === 'wait') { if (clock < b.start) return; b.state = 'enter'; }
    var s = sizeOf(b);
    if (b.state !== 'exit' && clock >= b.exitAt) { b.state = 'exit'; exitTarget(b); }
    if (b.state === 'enter' && b.x > s * 0.5 && b.x < VW - s * 0.5 && b.y > s * 0.5 && b.y < VH - s * 0.5) { b.state = 'roam'; pickTarget(b); }

    // depth drifts slowly: a little nearer, a little farther
    b.z = clamp(b.z0 + Math.sin(clock * TAU * b.zf + b.zp) * b.za, 0.02, 1);

    // gliding now and then: wings held open, a slow flutter
    b.glideT -= dt;
    if (b.glideT <= 0) {
      if (b.glide > 0.5) { b.glide = 0; b.glideT = rand(1.6, 4.2); }
      else { b.glide = 1; b.glideT = rand(0.35, 0.8); }
    }
    b.g = lerp(b.g || 0, b.glide, 1 - Math.exp(-dt * 6));
    b.phase += TAU * b.hz * lerp(1, 0.55, b.g) * dt;

    // steering: wander toward a moving target + smooth noise = loops, never a straight line
    if (b.state === 'roam' || b.state === 'enter') {
      b.retarget -= dt;
      if (b.retarget <= 0 || Math.hypot(b.tx - b.x, b.ty - b.y) < s * 1.2) pickTarget(b);
    }
    var want = Math.atan2(b.ty - b.y, b.tx - b.x);
    var seek = b.state === 'exit' ? clamp(wrap(want - b.h) * 2.6, -3, 3) : clamp(wrap(want - b.h) * 1.5, -2.4, 2.4);
    var noise = b.n1 * Math.sin(clock * TAU * b.f1 + b.p1) + b.n2 * Math.sin(clock * TAU * b.f2 + b.p2);
    var wander = b.state === 'exit' ? 0.3 : b.state === 'enter' ? 0.6 : 1;
    // keep inside the screen while roaming: steer harder back when past an edge
    if (b.state === 'roam') {
      var out = Math.max(0, -b.x, b.x - VW, -b.y, b.y - VH);
      if (out > 0) seek *= 1 + out / s;
    }
    var turn = seek + noise * wander;
    b.turn = lerp(b.turn, turn, 1 - Math.exp(-dt * 5));
    b.h = wrap(b.h + b.turn * dt);

    // speed: surges on each downstroke, slows while gliding, speeds up when leaving
    var wave = 0.5 + 0.5 * Math.sin(b.phase);
    var target = b.state === 'exit' ? 2.4 : b.stays && released ? 0.8 : 1;
    b.speedK = lerp(b.speedK, target, 1 - Math.exp(-dt * (b.state === 'exit' ? 2.2 : 1.5)));
    var v = speedOf(b) * b.speedK * (0.78 + 0.44 * wave) * lerp(1, 0.75, b.g);
    b.x += Math.cos(b.h) * v * dt;
    b.y += Math.sin(b.h) * v * dt;

    if (b.state === 'exit') {
      var gone = s * 1.2;
      if (b.x < -gone || b.x > VW + gone || b.y < -gone || b.y > VH + gone) b.dead = true;
    }
  }

  // keep butterflies at a similar depth from sitting on top of each other
  function separate(dt) {
    for (var i = 0; i < flock.length; i++) {
      var a = flock[i]; if (a.state === 'wait') continue;
      for (var j = i + 1; j < flock.length; j++) {
        var b = flock[j]; if (b.state === 'wait' || Math.abs(a.z - b.z) > 0.22) continue;
        var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = (sizeOf(a) + sizeOf(b)) * 0.42;
        if (d > 0.01 && d < min) {
          var push = (min - d) * 2.5 * dt / d;
          a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
        }
      }
    }
  }

  /* ---------------- drawing ---------------- */
  // wing angle above the horizontal: quick downstroke, slower upstroke
  function wings(b) {
    var p = b.phase + 0.55 * Math.sin(b.phase);          // phase warp = asymmetric beat
    var u = 0.5 - 0.5 * Math.cos(p);                      // 0 = wings down/open, 1 = wings up
    var up = lerp(78, 26, b.g), down = lerp(-14, -4, b.g);
    var deg = lerp(down, up, u);
    return { open: Math.max(0.1, Math.cos(deg * Math.PI / 180)), u: u, lift: Math.sin(p) };
  }

  function drawHalves(m, b, W, open, alpha, dx, dy, bob) {
    var s = sizeOf(b) / (SP.w - PAD * 2), h = SP.h * s;
    var L = pick(m, s * DPR), img = L.c, k = L.k, ax = SP.axis * k, sw = img.width, shh = img.height;
    var bank = clamp(b.turn * 0.1, -0.3, 0.3);
    var oL = open * (1 + bank), oR = open * (1 - bank);
    var sy = 1 - 0.05 * W.u;
    ctx.save();
    ctx.translate(b.x + dx, b.y + dy + bob);
    ctx.rotate(b.h + Math.PI / 2);
    ctx.scale(1, sy);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, 0, 0, ax, shh, -SP.axis * s * oL, -h / 2, SP.axis * s * oL, h);
    ctx.drawImage(img, ax, 0, sw - ax, shh, 0, -h / 2, (SP.w - SP.axis) * s * oR, h);
    ctx.restore();
    return { s: s, h: h, sy: sy, oL: oL, oR: oR };
  }

  // the shadow is one soft blob on the page: one draw, narrowed with the wings
  function drawShadow(b, W, off) {
    var s = sizeOf(b) / (SP.w - PAD * 2), L = pick(SP.shadow, s * DPR * 0.5);
    var w = SP.w * s * W.open, h = SP.h * s;
    ctx.save();
    ctx.translate(b.x + off * 0.55, b.y + off);
    ctx.rotate(b.h + Math.PI / 2);
    ctx.globalAlpha = b.alpha * lerp(0.2, 0.09, b.z);
    ctx.drawImage(L.c, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  var dirty = [], fullClear = true;
  function render() {
    // clear only where butterflies were last frame (much cheaper than the whole screen)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (fullClear) { ctx.clearRect(0, 0, cv.width, cv.height); fullClear = false; }
    else for (var d = 0; d < dirty.length; d++) { var r = dirty[d]; ctx.clearRect(r[0], r[1], r[2], r[3]); }
    dirty.length = 0;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'low';
    var live = flock.filter(function (b) { return b.state !== 'wait'; }).sort(function (a, b) { return a.z - b.z; });
    var i, b, W;
    // 1) soft shadows on the page; higher above the page = farther offset, lighter
    for (i = 0; i < live.length; i++) {
      b = live[i]; W = b.W = wings(b);
      var sz = sizeOf(b), off = sz * lerp(0.1, 0.32, b.z) + W.lift * sz * 0.03;
      // area this butterfly and its shadow cover, to clear next frame
      var rad = sz * 0.72 + 3, x0 = Math.min(b.x, b.x + off * 0.55) - rad, y0 = Math.min(b.y, b.y + off) - rad - sz * 0.06;
      dirty.push([Math.floor(x0 * DPR), Math.floor(y0 * DPR), Math.ceil((Math.abs(off * 0.55) + rad * 2) * DPR) + 2, Math.ceil((Math.abs(off) + rad * 2 + sz * 0.12) * DPR) + 2]);
      if (b.layer !== 'far') drawShadow(b, W, off);
    }
    // 2) butterflies, far to near
    for (i = 0; i < live.length; i++) {
      b = live[i]; W = b.W;
      var col = SP.colors[b.color], set = b.layer === 'near' ? col.soft : col.sharp;
      var bob = -W.lift * sizeOf(b) * 0.045;
      // the more the wings turn up, the less light they catch
      var shade = Math.min(SHADES.length - 1, Math.round((1 - W.open) * 0.55 * 4));
      var g = drawHalves(set[shade], b, W, W.open, b.alpha, 0, 0, bob);
      // body stays full width while the wings fold
      ctx.save();
      ctx.translate(b.x, b.y + bob);
      ctx.rotate(b.h + Math.PI / 2);
      ctx.scale(1, g.sy);
      ctx.globalAlpha = b.alpha;
      var bw = col.bodyW * g.s, BL = pick(col.body, g.s * DPR);
      ctx.drawImage(BL.c, -bw / 2, -g.h / 2, bw, g.h);
      ctx.restore();
    }
  }

  function frame(t) {
    raf = 0;
    
    var raw = last ? (t - last) / 1000 : 0.016, dt = Math.min(raw, 0.05);
    // if many frames arrive late, draw at a lower density (sharp 2x -> 1.5x -> 1x); never goes back up
    if (last && raw < 0.25) {
      seen++; if (raw > 0.024) slow++;
      if (seen >= 45) {
        if (slow >= 10 && DPR > 1) { maxDpr = DPR > 1.5 ? 1.5 : 1; resize(); }
        seen = 0; slow = 0;
      }
    }
    last = t; clock += dt;
    if (clock >= releaseAt) { releaseAt = Infinity; release(); }
    for (var i = 0; i < flock.length; i++) step(flock[i], dt);
    separate(dt);
    for (i = flock.length - 1; i >= 0; i--) if (flock[i].dead) flock.splice(i, 1);
    render();
    
    if (flock.length) raf = requestAnimationFrame(frame);
    else { last = 0; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); fullClear = true; }
  }
  function start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

  // a background tab gets no frames; restart the clock cleanly on return
  document.addEventListener('visibilitychange', function () { last = 0; });
  if (mq && mq.addEventListener) mq.addEventListener('change', function (e) { if (e.matches) stop(); });

  /* ---------------- boot ---------------- */
  var pending = false;
  api.play = function () { if (mq && mq.matches) return; play(); };
  api.release = function () { release(); };
  api.stop = stop;

  var img = new Image();
  img.decoding = 'async';
  img.onload = function () {
    
    buildSprites(img, function (sp) {
      SP = sp;
      
      
      if (pending || CFG.autoplay) { pending = false; whenReady(play); }
    });
  };
  img.src = IMG_SRC;
  function whenReady(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }
})();
