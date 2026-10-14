import { Component } from '@angular/core';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'samchat';

   constructor(
    private AuthService: AuthService,
    private router: Router
  ){

  }

  logout() {
    this.AuthService.logout();
    this.router.navigate(['/login']);
  }

  logado(): boolean {
    return this.AuthService.logado();
  }
}
