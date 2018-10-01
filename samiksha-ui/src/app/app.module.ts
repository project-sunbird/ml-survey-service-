import { BrowserModule } from "@angular/platform-browser";
import { NgModule } from "@angular/core";

import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { RoutingModule } from "./modules/routing/routing.module";

import { AppComponent } from "./app.component";
import { AddQuestionComponent } from "./pages/add-question/add-question.component";
import { HeaderComponent } from "./components/header/header.component";
import { FooterComponent } from "./components/footer/footer.component";
import { SidebarComponent } from "./components/sidebar/sidebar.component";

import { LayoutModule } from "@angular/cdk/layout";
import {
  MatToolbarModule,
  MatButtonModule,
  MatSidenavModule,
  MatIconModule,
  MatListModule,
  MatGridListModule,
  MatCardModule,
  MatMenuModule,
  MatFormFieldModule,
  MatInputModule,
  MatOptionModule,
  MatSelectModule
} from "@angular/material";
import { NavigationComponent } from "./components/navigation/navigation.component";
import { FormsModule } from "@angular/forms";

@NgModule({
  declarations: [
    AppComponent,
    AddQuestionComponent,
    HeaderComponent,
    FooterComponent,
    SidebarComponent,
    NavigationComponent
  ],
  imports: [
    BrowserModule,
    RoutingModule,
    BrowserAnimationsModule,
    LayoutModule,
    MatIconModule,
    MatToolbarModule,
    MatButtonModule,
    MatSidenavModule,
    MatListModule,
    MatGridListModule,
    MatCardModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
