import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Usuario } from '../../models/usuario';
import { Mensagem } from 'src/app/models/mensagem';

@Injectable({
  providedIn: 'root'
})
export class KeyboardService {


  constructor(private http: HttpClient) {}


}
