import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/auth.service';
import { ActivatedRoute, Router } from '@angular/router';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {

  email = '';
  senha = '';

  message: String = '';
  cadastroSucesso = false;

  constructor(private authService: AuthService, private router: Router, route: ActivatedRoute) {
    if (route.snapshot.queryParamMap.get('cadastro') === 'sucesso') {
      this.cadastroSucesso = true;
      this.message = 'Conta criada com sucesso. Entre com seu email e senha.';
    }
  }

  login() {
  this.cadastroSucesso = false;
  this.authService.login(this.email, this.senha)
    .subscribe({
      next: (res) => {
          localStorage.setItem('token', res.token);
          this.router.navigate(['/synth']);
      },
      error: (err) => {
        console.error('Erro:', err);
        this.message = "Usuário/senha inválidos"
      }
    });
  }

  logout() {
    this.authService.logout();
  }

}
