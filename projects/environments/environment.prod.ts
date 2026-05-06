
let host = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');

const prefix = 'mmis'

export const environment = {
  production: true,
  printCSS: '',
  serverApi: `${host}/Api`,
  PASSWORD_SECRET_KEY: "08t16e502526fesanfjh8nasd2",
  CAPTCHA_SECRET_KEY: '03f26e402586fkisanf2395fsg9632faa8da4c98a35f1b20d6b033c50',
  publicKey: "BLaV0kn22SFt30rA1H6lEX6dgTOzToFY3bVfCXzGwM0gg2CFEjILyLp4qoL8H_hNFaJhOYndp4vquNH6zYy5r2M",
  sharedSecret: 'tg:D/|oP$:s2I[-8-Pc:|8/U7+?!r]g#',
  recruitmentFileBaseUrl: `${host}/mmis/__Files`
};

export const reportConfig = {
  orientation: 'portrait',
  is_read: false,
  listLength: 0,
  is_pagination: true,
  is_server_pagination: true,
  is_filter: true,
  dataSource: [],
  button: ['pdf', 'print', 'copy', 'excel'],
  is_render: false,
  page: 0,
  pageSize: 10
}

export const moduleMapping: any = {
  loginModule: `${host}/${prefix}/recruitmentCandidate/home`,
}


export const apiPort: any = {
  adminApi: `${host}/${prefix}/adminApi`,
  commonApi: `${host}/${prefix}/commonApi`,
  academicApi: `${host}/${prefix}/academicApi`,
  recruitementApi: `${host}/${prefix}/recruitementApi`,
}

