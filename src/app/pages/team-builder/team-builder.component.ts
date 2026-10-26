import { CitadelFrameComponent } from '../../shared/citadel-frame.component';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TeamPresetsComponent } from '../../shared/team-presets.component';
import { IconComponent } from '../../shared/icon.component';
import { PlacementComponent } from '../../battle/placement/placement.component';

/** Persistent formation editor; stage-specific enemy previews belong to battle preparation. */
@Component({
  selector: 'app-team-builder',
  imports: [CitadelFrameComponent, PlacementComponent, RouterLink, TeamPresetsComponent, IconComponent],
  templateUrl: './team-builder.component.html',
  styleUrl: './team-builder.component.scss',
})
export class TeamBuilderComponent {}
