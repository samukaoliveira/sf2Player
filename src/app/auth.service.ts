import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = `${environment.apiUrl}/login`;

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, senha: string) {
    return this.http.post<any>(`${environment.apiUrl}/login`, {
      email,
      senha
    });
  }

  logout() {
    localStorage.removeItem('token');
  }

  logado(): boolean{
     return !!this.getToken();
  }

  getToken() {
    return localStorage.getItem('token');
  }
}
