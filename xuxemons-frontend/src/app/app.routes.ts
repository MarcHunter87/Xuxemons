import { Routes } from '@angular/router';
import { Login } from './Pages/Auth/login/login';
import { Register } from './Pages/Auth/register/register';

export const routes: Routes = [

    {
        path: '',
        component: Login
    },
    {
        path: 'register',
        component: Register
    }

];
