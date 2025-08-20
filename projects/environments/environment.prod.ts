let host = window.location.protocol + '//igkv.com'

export const environmentProd = {
  production: true,
  printCSS: '',
  serverApi: `${host}/Api`,
  PASSWORD_SECRET_KEY: "08t16e502526fesanfjh8nasd2",
  sharedSecret: 'tg:D/|oP$:s2I[-8-Pc:|8/U7+?!r]g#',

  studentModule: `${host}/student`,
  memberModule: `${host}/member`,
  adminModule: `${host}/admin`,
  homeModule: `${host}`,
  loginModule: `${host}/user/login`,
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
  button: ['pdf', 'print', 'copy', 'excel'],
  is_render: false,
  page: 0,
  pageSize: 10
}

export const moduleMapping: any = {
  homeModule: `${host}/common`,
  loginModule: `${host}/user/login`,
  adminModule: `${host}/admin`,
  recruitmentModule: `${host}/recruitment`,
  academicModule: `${host}/academic`,
  admissionModule: `${host}/admission`,
  establishmentModule: `${host}/establishment`,
}

export const apiPort: any = {
  adminApi: `${host}/adminApi`,
  commonApi: `${host}/commonApi`,
  demoApi: `${host}/demoApi`,
}

