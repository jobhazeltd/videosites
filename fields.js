// ====== EXTRA FIELDS — naam sirf yahan badlein ======
// label       = admin form aur public page pe jo naam dikhe
// placeholder = khali box mein halka sa hint
// public      = true -> watch page pe dikhega, false -> sirf admin mein
// type        = 'text' (ek line) ya 'textarea' (lambi likhai)
//
// NOTE: key (extra1 ... extra6) ko mat badlein — purana data isi se juda hai.
window.EXTRA_FIELDS = [
  { key: 'extra1', label: 'Release date:', placeholder: '', public: true, type: 'text' },
  { key: 'extra2', label: 'Code:', placeholder: '', public: true, type: 'text' },
  { key: 'extra3', label: 'Actress:', placeholder: '', public: true, type: 'text' },
  { key: 'extra4', label: 'Genre:', placeholder: '', public: true, type: 'text' },
  { key: 'extra5', label: 'Series:', placeholder: '', public: true, type: 'text' },
  { key: 'extra6', label: 'Maker:', placeholder: '', public: true, type: 'textarea' },
];
