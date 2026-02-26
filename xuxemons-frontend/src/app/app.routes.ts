import { Routes } from '@angular/router';
import { Login } from './Pages/Auth/login/login';
import { Register } from './Pages/Auth/register/register';
import { Home } from './Pages/home/home';

export const routes: Routes = [

    {
        path: '',
        component: Home,
        // canActivate: [AuthGuard]
    },
    {
        path: 'register',
        component: Register
    },
    {
        path: 'login',
        component: Login
    }

];
