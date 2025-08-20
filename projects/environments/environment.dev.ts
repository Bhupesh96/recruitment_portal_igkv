let host;
if (typeof window !== 'undefined') {
  host = window.location.protocol + '//' + window.location.hostname;
} else {
  host = 'http://localhost'; // or whatever default you prefer
}

export const environment = {
  production: false,
  printCSS: `${host}:3000/commonApi/printcss.css`,
  PASSWORD_SECRET_KEY: "08t16e502526fesanfjh8nasd2",
  CAPTCHA_SECRET_KEY: '03f26e402586fkisanf2395fsg9632faa8da4c98a35f1b20d6b033c50',
  sharedSecret: 'tg:D/|oP$:s2I[-8-Pc:|8/U7+?!r]g#',
  publicKey: "BLaV0kn22SFt30rA1H6lEX6dgTOzToFY3bVfCXzGwM0gg2CFEjILyLp4qoL8H_hNFaJhOYndp4vquNH6zYy5r2M"
};

export const reportConfig = {
  orientation: 'portrait',
  is_read: false,
  listLength: 0,
  is_pagination: true,
  is_server_pagination: true,
  is_filter: true,
  dataSource: [],
  // button: ['pdf', 'print', 'copy', 'excel'],
  button: [],
  is_render: false,
  page: 0,
  pageSize: 10
};

export const moduleMapping: any = {
  adminModule: `${host}:4300`,
  homeModule: `${host}:4200/common`,
  loginModule: `${host}:4200/user/login`,
  recruitementModule: `${host}:4340`,
  academicModule: `${host}:4310`,
  admissionModule: `${host}:4320`,
  establishmentModule: `${host}:4330`,

};

export const apiPort: any = {
  adminApi: `${host}:3001/adminApi`,
  commonApi: `${host}:3000/commonApi`,
  demoApi: `${host}:3002/demoApi`,
  academicApi: `${host}:3003/academicApi`,
  recruitementApi: `${host}:3500/recruitementApi`,
};
