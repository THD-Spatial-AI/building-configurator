# Building Configurator

[![MkDocs](https://github.com/THD-Spatial-AI/building-configurator/actions/workflows/docs.yml/badge.svg)](https://THD-Spatial-AI.github.io/building-configurator/)
&nbsp;
[![CodeQL](https://github.com/THD-Spatial-AI/building-configurator/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/THD-Spatial-AI/building-configurator/actions/workflows/github-code-scanning/codeql)

A React component for modelling building properties within the [EnerPlanET](https://enerplanet.th-deg.de/) platform. It provides a reusable configuration interface for energy simulation workflows, including annual heat demand estimation (HDCP) and thermal load profiling (BUEM), with the intent to support additional simulation services over time.

## Features

- Configure building geometry, envelope elements, and thermal parameters
- Set up roof and photovoltaic (PV) system properties
- Visualise the building energy envelope and surface composition
- View simulated heating and cooling load profiles
- Step-by-step configuration workflow with live building snapshot

## Running the code

```bash
npm install
npm run dev
```

## Try it out

Deployed on Vercel: [building-configurator.vercel.app](https://building-configurator-phi.vercel.app/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to report bugs, request features, and submit pull requests.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Designed and developed by

[Jay Ravani](https://github.com/jravani)

## Acknowledgments

This project is being developed in the context of the research project RENvolveIT (<https://projekte.ffg.at/projekt/5127011>).
This research was funded by CETPartnership, the Clean Energy Transition Partnership under the 2023 joint call for research proposals, co-funded by the European Commission (GA N°101069750) and with the funding organizations detailed on <https://cetpartnership.eu/funding-agencies-and-call-modules>.

<img src="docs/assets/sponsors/CETP-logo.svg" alt="CETPartnership" width="144" height="72">&nbsp;&nbsp;<img src="docs/assets/sponsors/EN_Co-fundedbytheEU_RGB_POS.png" alt="EU" width="180" height="40">
