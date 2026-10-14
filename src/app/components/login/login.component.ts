import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/auth.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {

  email = '';
  senha = '';

  message: String = '';

  constructor(private authService: AuthService, private router: Router) { }

  login() {
  this.authService.login(this.email, this.senha)
    .subscribe({
      next: (res) => {
          localStorage.setItem('token', res.token);
          this.router.navigate(['/conversas']);
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
