<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>ODJIM GO</title>

  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#0a1cff">

  <meta name="viewport" content="width=device-width, initial-scale=1.0">

</head>
<body>
  <h1>ODJIM GO</h1>
  <p>App em teste online 🚀</p>

  <button onclick="alert('Bem-vindo ao ODJIM GO')">Entrar</button>

  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js');
    }
  </script>
</body>
</html>
