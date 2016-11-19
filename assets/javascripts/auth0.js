/* global Auth0Lock */
(function() {
  function appendScript(src, callback) {
    var new_script = document.createElement('script');
    new_script.setAttribute('src', src);
    new_script.onload = callback;
    document.head.appendChild(new_script);
  }

  function appendLink(href) {
    var new_link = document.createElement("link");
    new_link.setAttribute('type', 'text/css');
    new_link.setAttribute('rel', 'stylesheet');
    new_link.setAttribute('href', href);
    document.head.appendChild(new_link);
  }

  var lock;

  var script_url = '//cdn.auth0.com/js/lock/10.5.0/lock.js';

  appendScript(script_url, function() {
    var checkInterval = setInterval(function() {
      if (!Discourse.SiteSettings) {
        return;
      }

      clearInterval(checkInterval);

      if (!Discourse.SiteSettings.auth0_client_id) {
        return;
      }

      var client_id = Discourse.SiteSettings.auth0_client_id;
      var domain = Discourse.SiteSettings.auth0_domain;
      var lock_options = {
        language: "es",
        auth: {
          responseType: 'code',
	  redirect: false,
          redirectUrl: Discourse.SiteSettings.auth0_callback_url
        },
        theme: {
          logo: "https://recursos.partidodigital.org.uy/assets/img/logo_original.svg",
          primaryColor: "#F37021"
        },
        allowForgotPassword: true,
        allowLogin: true,
        loginAfterSignUp: false,
        mustAcceptTerms: true,
        languageDictionary: {
          signUpTerms: "Acepto los <a href='https://partidodigital.com/documentos/terminos-de-uso' target='_new'>términos de uso</a> y <a href='https://partidodigital.com/documentos/privacidad-de-datos' target='_new'>privacidad de datos</a>.",
          title: "Acceso",
          success: {
            signUp: "Registro completado exitosamente. Chequea tu correo para verificar tu dirección y seguir con los próximos pasos."
          }
        },
        additionalSignUpFields: [{
          name: "credencial",
          placeholder: "ingrese su credencial",
          icon: "https://recursos.partidodigital.org.uy/assets/img/credencial.png",
          validator: function(credencial) {
            function isNumber(n) {
              return !isNaN(parseFloat(n)) && isFinite(n)
            }
            var split = credencial.split(" ");
            return {
              valid: split.length === 2 && !isNumber(split[0]) && isNumber(split[1]),
              hint: "Aseguresé de ingresar su credencial en formato \"ABC 12345\" con un espacio."
            };
          }
        }]
      };

      lock = new Auth0Lock(client_id, domain, lock_options);
      var auth0 = new Auth0({
        domain: domain,
        clientID: client_id,
	callbackUrl: Discourse.SiteSettings.auth0_callback_url/*,
	callbackOnLocationHash: true*/
      });

      // Handle authenticated event to store id_token in localStorage
      lock.on("authenticated", function(authResult) {
        isAuthCallback = true;

        lock.getProfile(authResult.idToken, function(error, profile) {
          if (error) {
            console.error(error);
            return;
          }

          localStorage.setItem('userToken', authResult.idToken);
          return;
        });
      });

      var isAuthCallback = false;

      // Get the user token if we've saved it in localStorage before
      var idToken = localStorage.getItem('userToken');
      if (!idToken) {
        // user is not logged, check whether there is an SSO session or not
        auth0.getSSOData(function(err, data) {
          if (!isAuthCallback && !err && data.sso) {
            // there is! redirect to Auth0 for SSO
            auth0.signin({
              connection: data.lastUsedConnection.name,
              scope: 'openid name picture',
	      callbackUrl: Discourse.SiteSettings.auth0_callback_url
            });
          }
        });
      }

    }, 300);
  });

  appendLink('https://recursos.partidodigital.org.uy/assets/css/auth0.css');

  var LoginController = require('discourse/controllers/login').default;
  LoginController.reopen({
    authenticationComplete: function() {
      if (lock) {
        lock.hide();
      }
      return this._super.apply(this, arguments);
    }
  });

  var ApplicationRoute = require('discourse/routes/application').default;
  ApplicationRoute.reopen({
    actions: {
      showLogin: function() {
        if (!Discourse.SiteSettings.auth0_client_id || Discourse.SiteSettings.auth0_connection !== '') {
          return this._super();
        }

        lock.show();

        this.controllerFor('login').resetForm();
      },
      showCreateAccount: function() {
        if (!Discourse.SiteSettings.auth0_client_id || Discourse.SiteSettings.auth0_connection !== '') {
          return this._super();
        }

        var createAccountController = Discourse.__container__.lookup('controller:createAccount');

        if (createAccountController && createAccountController.accountEmail) {
          if (lock) {
            lock.hide();
            Discourse.Route.showModal(this, 'createAccount');
          } else {
            this._super();
          }
        } else {
          lock.show({
            initialScreen: 'signUp'
          });
        }
      }
    }
  });

})();
